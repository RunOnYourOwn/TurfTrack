import datetime
from app.celery_app import app
from app.core.database import async_session_maker, SessionLocal
from app.utils.weather import upsert_daily_weather, upsert_daily_weather_sync
from app.models.daily_weather import WeatherType
import openmeteo_requests
from app.models.lawn import Lawn
from sqlalchemy.future import select
from app.models.task_status import TaskStatus, TaskStatusEnum
import asyncio
from sqlalchemy import and_, insert, update, text
from sqlalchemy.dialects.postgresql import insert
from app.models.daily_weather import DailyWeather
from sqlalchemy.orm import Session
from app.models.location import Location
import logging

logger = logging.getLogger(__name__)


def create_or_update_task_status_sync(
    session: Session,
    task_id: str,
    task_name: str,
    location_id: int,
    status: TaskStatusEnum,
    started: bool = False,
    finished: bool = False,
    error: str = None,
):
    # Check if record exists
    stmt = select(TaskStatus).where(
        and_(
            TaskStatus.task_id == task_id,
            TaskStatus.task_name == task_name,
            TaskStatus.related_location_id == location_id,
        )
    )
    result = session.execute(stmt)
    existing_status = result.scalar_one_or_none()

    if existing_status:
        # Update existing record
        existing_status.status = status
        if started:
            existing_status.started_at = datetime.datetime.now(datetime.timezone.utc)
        if finished:
            existing_status.finished_at = datetime.datetime.now(datetime.timezone.utc)
        if error:
            existing_status.error = error
    else:
        # Create new record
        new_status = TaskStatus(
            task_id=task_id,
            task_name=task_name,
            related_location_id=location_id,
            status=status,
            started_at=datetime.datetime.now(datetime.timezone.utc)
            if started
            else None,
            finished_at=datetime.datetime.now(datetime.timezone.utc)
            if finished
            else None,
            error=error,
        )
        session.add(new_status)

    session.commit()


async def create_or_update_task_status(
    session,
    task_id,
    task_name,
    location_id,
    status,
    error=None,
    result=None,
    started=False,
    finished=False,
):
    result_db = await session.execute(
        select(TaskStatus).where(TaskStatus.task_id == task_id)
    )
    task_status = result_db.scalars().first()
    now = datetime.datetime.now(datetime.timezone.utc)
    if not task_status:
        task_status = TaskStatus(
            task_id=task_id,
            task_name=task_name,
            related_location_id=location_id,
            status=status,
            created_at=now,
            started_at=now if started else None,
            finished_at=now if finished else None,
            error=error,
            result=result,
        )
        session.add(task_status)
    else:
        task_status.status = status
        if started:
            task_status.started_at = now
        if finished:
            task_status.finished_at = now
        if error:
            task_status.error = error
        if result:
            task_status.result = result
    await session.commit()


@app.task(name="fetch_and_store_weather", bind=True)
def fetch_and_store_weather(self, location_id: int, latitude: float, longitude: float):
    task_id = self.request.id
    with SessionLocal() as session:
        try:
            create_or_update_task_status_sync(
                session,
                task_id,
                "fetch_and_store_weather",
                location_id,
                TaskStatusEnum.started,
                started=True,
            )
            _fetch_and_store_weather_sync(location_id, latitude, longitude, session)
            create_or_update_task_status_sync(
                session,
                task_id,
                "fetch_and_store_weather",
                location_id,
                TaskStatusEnum.success,
                finished=True,
            )
        except Exception as e:
            create_or_update_task_status_sync(
                session,
                task_id,
                "fetch_and_store_weather",
                location_id,
                TaskStatusEnum.failure,
                error=str(e),
                finished=True,
            )
            raise


def _fetch_and_store_weather_sync(
    location_id: int, latitude: float, longitude: float, session
):
    om = openmeteo_requests.Client()
    # Fetch historical (past 60 days)
    today = datetime.date.today()
    start_hist = today - datetime.timedelta(days=60)
    end_hist = today - datetime.timedelta(days=2)
    params_hist = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_hist.isoformat(),
        "end_date": end_hist.isoformat(),
        "daily": [
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "precipitation_probability_max",
            "wind_speed_10m_max",
            "wind_gusts_10m_max",
            "wind_direction_10m_dominant",
            "et0_fao_evapotranspiration",
        ],
        "timezone": "auto",
    }
    responses_hist = om.weather_api(
        "https://api.open-meteo.com/v1/forecast", params=params_hist
    )
    response_hist = responses_hist[0]
    daily_hist = response_hist.Daily()
    # Build and upsert historical data
    for i, date in enumerate(_get_dates(daily_hist)):
        data = _extract_weather_data(daily_hist, i)
        upsert_daily_weather_sync(
            session, location_id, date, WeatherType.historical, data
        )

    # Fetch forecast (next 16 days)
    params_forecast = {
        "latitude": latitude,
        "longitude": longitude,
        "forecast_days": 16,
        "daily": [
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "precipitation_probability_max",
            "wind_speed_10m_max",
            "wind_gusts_10m_max",
            "wind_direction_10m_dominant",
            "et0_fao_evapotranspiration",
        ],
        "timezone": "auto",
    }
    responses_forecast = om.weather_api(
        "https://api.open-meteo.com/v1/forecast", params=params_forecast
    )
    response_forecast = responses_forecast[0]
    daily_forecast = response_forecast.Daily()
    for i, date in enumerate(_get_dates(daily_forecast)):
        data = _extract_weather_data(daily_forecast, i)
        upsert_daily_weather_sync(
            session, location_id, date, WeatherType.forecast, data
        )


def _get_dates(daily):
    import pandas as pd

    dates = pd.date_range(
        start=pd.to_datetime(daily.Time(), unit="s"),
        end=pd.to_datetime(daily.TimeEnd(), unit="s"),
        freq=pd.Timedelta(seconds=daily.Interval()),
        inclusive="left",
    )
    return dates


def _extract_weather_data(daily, i):
    return {
        "temperature_max_c": float(daily.Variables(0).ValuesAsNumpy()[i]),
        "temperature_max_f": float(daily.Variables(0).ValuesAsNumpy()[i] * 9 / 5 + 32),
        "temperature_min_c": float(daily.Variables(1).ValuesAsNumpy()[i]),
        "temperature_min_f": float(daily.Variables(1).ValuesAsNumpy()[i] * 9 / 5 + 32),
        "precipitation_mm": float(daily.Variables(2).ValuesAsNumpy()[i]),
        "precipitation_in": float(daily.Variables(2).ValuesAsNumpy()[i] / 25.4),
        "precipitation_probability_max": float(daily.Variables(3).ValuesAsNumpy()[i]),
        "wind_speed_max_ms": float(daily.Variables(4).ValuesAsNumpy()[i]),
        "wind_speed_max_mph": float(daily.Variables(4).ValuesAsNumpy()[i] * 2.23694),
        "wind_gusts_max_ms": float(daily.Variables(5).ValuesAsNumpy()[i]),
        "wind_gusts_max_mph": float(daily.Variables(5).ValuesAsNumpy()[i] * 2.23694),
        "wind_direction_dominant_deg": float(daily.Variables(6).ValuesAsNumpy()[i]),
        "et0_evapotranspiration_mm": float(daily.Variables(7).ValuesAsNumpy()[i]),
        "et0_evapotranspiration_in": float(
            daily.Variables(7).ValuesAsNumpy()[i] / 25.4
        ),
    }


def _update_recent_weather_for_location_sync(
    location_id: int, latitude: float, longitude: float
):
    with SessionLocal() as session:
        om = openmeteo_requests.Client()
        # Fetch only yesterday's historical data
        today = datetime.date.today()
        yesterday = today - datetime.timedelta(days=1)
        params_hist = {
            "latitude": latitude,
            "longitude": longitude,
            "start_date": yesterday.isoformat(),
            "end_date": yesterday.isoformat(),
            "daily": [
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "precipitation_probability_max",
                "wind_speed_10m_max",
                "wind_gusts_10m_max",
                "wind_direction_10m_dominant",
                "et0_fao_evapotranspiration",
            ],
            "timezone": "auto",
        }
        responses_hist = om.weather_api(
            "https://api.open-meteo.com/v1/forecast", params=params_hist
        )
        response_hist = responses_hist[0]
        daily_hist = response_hist.Daily()
        for i, date in enumerate(_get_dates(daily_hist)):
            data = _extract_weather_data(daily_hist, i)
            upsert_daily_weather_sync(
                session, location_id, date, WeatherType.historical, data
            )

        # Fetch forecast (next 16 days)
        params_forecast = {
            "latitude": latitude,
            "longitude": longitude,
            "forecast_days": 16,
            "daily": [
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "precipitation_probability_max",
                "wind_speed_10m_max",
                "wind_gusts_10m_max",
                "wind_direction_10m_dominant",
                "et0_fao_evapotranspiration",
            ],
            "timezone": "auto",
        }
        responses_forecast = om.weather_api(
            "https://api.open-meteo.com/v1/forecast", params=params_forecast
        )
        response_forecast = responses_forecast[0]
        daily_forecast = response_forecast.Daily()
        for i, date in enumerate(_get_dates(daily_forecast)):
            data = _extract_weather_data(daily_forecast, i)
            upsert_daily_weather_sync(
                session, location_id, date, WeatherType.forecast, data
            )


@app.task(name="update_weather_for_all_lawns", bind=True)
def update_weather_for_all_lawns(self):
    task_id = self.request.id
    with SessionLocal() as session:
        result = session.execute(select(Lawn).where(Lawn.weather_enabled.is_(True)))
        lawns = result.scalars().all()
        for lawn in lawns:
            location = lawn.location
            if location:
                try:
                    create_or_update_task_status_sync(
                        session,
                        task_id,
                        "update_recent_weather_for_location",
                        location.id,
                        TaskStatusEnum.started,
                        started=True,
                    )
                    _update_recent_weather_for_location_sync(
                        location.id,
                        location.latitude,
                        location.longitude,
                    )
                    create_or_update_task_status_sync(
                        session,
                        task_id,
                        "update_recent_weather_for_location",
                        location.id,
                        TaskStatusEnum.success,
                        finished=True,
                    )
                except Exception as e:
                    create_or_update_task_status_sync(
                        session,
                        task_id,
                        "update_recent_weather_for_location",
                        location.id,
                        TaskStatusEnum.failure,
                        error=str(e),
                        finished=True,
                    )
                    raise

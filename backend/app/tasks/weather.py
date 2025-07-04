import datetime
from app.celery_app import app
from app.core.database import SessionLocal
from app.models.daily_weather import WeatherType
from app.models.location import Location
import openmeteo_requests
from app.models.lawn import Lawn
from sqlalchemy.future import select
from app.models.task_status import TaskStatus, TaskStatusEnum
from sqlalchemy import and_, text
from sqlalchemy.orm import Session
import logging
from app.models.gdd import GDDModel
from app.utils.gdd import calculate_and_store_gdd_values_sync_segmented
from sqlalchemy.exc import SQLAlchemyError
import requests
from app.models.gdd import GDDReset, ResetType

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
    try:
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
            except (requests.exceptions.RequestException, SQLAlchemyError) as e:
                logger.error(f"Weather task failed for loc {location_id}: {e}")
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
            except Exception as e:
                logger.error(
                    f"An unexpected error occurred in weather task for loc {location_id}: {e}"
                )
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "fetch_and_store_weather",
                    location_id,
                    TaskStatusEnum.failure,
                    error="An unexpected error occurred.",
                    finished=True,
                )
                raise
    except SQLAlchemyError as e:
        logger.critical(f"Database connection failed for weather task: {e}")
        # Cannot update task status if DB is down, Celery will retry
        raise


def _fetch_and_store_weather_sync(
    location_id: int, latitude: float, longitude: float, session
):
    from app.utils.weather import upsert_daily_weather_sync

    om = openmeteo_requests.Client()
    today = datetime.date.today()

    # Unified API call for past and forecast data
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "past_days": 60,
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
            "relative_humidity_2m_mean",
            "relative_humidity_2m_max",
            "relative_humidity_2m_min",
            "dew_point_2m_max",
            "dew_point_2m_min",
            "dew_point_2m_mean",
            "sunshine_duration",
        ],
        "timezone": "auto",
    }
    responses = om.weather_api("https://api.open-meteo.com/v1/forecast", params=params)
    response = responses[0]
    daily = response.Daily()

    # Build and upsert data
    for i, date in enumerate(_get_dates(daily)):
        data = _extract_weather_data(daily, i)
        weather_type = (
            WeatherType.historical if date.date() < today else WeatherType.forecast
        )
        upsert_daily_weather_sync(session, location_id, date, weather_type, data)


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
    data = {
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
        "relative_humidity_mean": float(daily.Variables(8).ValuesAsNumpy()[i]),
        "relative_humidity_max": float(daily.Variables(9).ValuesAsNumpy()[i]),
        "relative_humidity_min": float(daily.Variables(10).ValuesAsNumpy()[i]),
        "dew_point_max_c": float(daily.Variables(11).ValuesAsNumpy()[i]),
        "dew_point_max_f": float(daily.Variables(11).ValuesAsNumpy()[i] * 9 / 5 + 32),
        "dew_point_min_c": float(daily.Variables(12).ValuesAsNumpy()[i]),
        "dew_point_min_f": float(daily.Variables(12).ValuesAsNumpy()[i] * 9 / 5 + 32),
        "dew_point_mean_c": float(daily.Variables(13).ValuesAsNumpy()[i]),
        "dew_point_mean_f": float(daily.Variables(13).ValuesAsNumpy()[i] * 9 / 5 + 32),
        "sunshine_duration_s": float(daily.Variables(14).ValuesAsNumpy()[i]),
        "sunshine_duration_h": float(daily.Variables(14).ValuesAsNumpy()[i] / 3600),
    }
    return data


def _get_historical_start_date(session, location_id: int) -> datetime.date:
    """
    Determine the optimal start date for fetching historical weather data.

    Strategy:
    1. Find the earliest forecast date for this location
    2. If forecast data exists and is before today, use that date as start
    3. If no forecast data or earliest date is today/future, use 7 days ago as fallback

    This ensures we fill gaps in weather data when the app has been offline.
    """
    from app.models.daily_weather import DailyWeather, WeatherType

    today = datetime.date.today()

    # Query earliest forecast date for this location
    stmt = (
        select(DailyWeather.date)
        .where(
            and_(
                DailyWeather.location_id == location_id,
                DailyWeather.type == WeatherType.forecast,
            )
        )
        .order_by(DailyWeather.date.asc())
        .limit(1)
    )

    result = session.execute(stmt)
    earliest_forecast_date = result.scalar_one_or_none()
    logger.info(
        f"Location {location_id}: Earliest forecast date: {earliest_forecast_date}"
    )

    if earliest_forecast_date and earliest_forecast_date < today:
        # Use the earliest forecast date as our start date
        logger.info(
            f"Location {location_id}: Using earliest forecast date {earliest_forecast_date} "
            f"as historical start date (today: {today})"
        )
        return earliest_forecast_date
    else:
        # Fallback: use 7 days ago to ensure we have some historical context
        fallback_date = today - datetime.timedelta(days=7)
        logger.info(
            f"Location {location_id}: No forecast data found or earliest date is today/future. "
            f"Using fallback start date {fallback_date} (today: {today})"
        )
        return fallback_date


def _update_recent_weather_for_location_sync(
    location_id: int, latitude: float, longitude: float
):
    from app.utils.weather import upsert_daily_weather_sync

    with SessionLocal() as session:
        om = openmeteo_requests.Client()

        # Determine the optimal start date for historical data
        historical_start_date = _get_historical_start_date(session, location_id)
        today = datetime.date.today()

        # Fetch historical data from the calculated start date to today
        params_hist = {
            "latitude": latitude,
            "longitude": longitude,
            "start_date": historical_start_date.isoformat(),
            "end_date": today.isoformat(),
            "daily": [
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "precipitation_probability_max",
                "wind_speed_10m_max",
                "wind_gusts_10m_max",
                "wind_direction_10m_dominant",
                "et0_fao_evapotranspiration",
                "relative_humidity_2m_mean",
                "relative_humidity_2m_max",
                "relative_humidity_2m_min",
                "dew_point_2m_max",
                "dew_point_2m_min",
                "dew_point_2m_mean",
                "sunshine_duration",
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
                "relative_humidity_2m_mean",
                "relative_humidity_2m_max",
                "relative_humidity_2m_min",
                "dew_point_2m_max",
                "dew_point_2m_min",
                "dew_point_2m_mean",
                "sunshine_duration",
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

        # Extra safety: Remove any forecast where a historical exists for the same date/location
        session.execute(
            text("""
                DELETE FROM daily_weather f
                USING daily_weather h
                WHERE f.date = h.date
                  AND f.location_id = h.location_id
                  AND f.type = 'forecast'
                  AND h.type = 'historical'
            """)
        )
        session.commit()

        # Trigger GDD recalculation for this location
        from app.tasks.weather import recalculate_gdd_for_location

        recalculate_gdd_for_location.delay(location_id)


@app.task(name="update_weather_for_all_lawns", bind=True)
def update_weather_for_all_lawns(self):
    """
    Refresh historical weather data and 16-day forecast for every Location that has at least
    one lawn with weather updates enabled.

    Historical data fetching strategy:
    - Finds the earliest forecast date in the database for each location
    - Fetches historical data from that date to today to fill any gaps
    - If no forecast data exists, fetches from 7 days ago to today
    - This ensures weather data continuity even if the app has been offline
    """
    task_id = self.request.id
    try:
        with SessionLocal() as session:
            # Create task status record for start
            create_or_update_task_status_sync(
                session,
                task_id,
                "update_weather_for_all_lawns",
                None,  # No specific location_id for this task
                TaskStatusEnum.started,
                started=True,
            )

            # One row per unique Location that has an enabled Lawn
            stmt = (
                select(
                    Location.id.label("location_id"),
                    Location.latitude,
                    Location.longitude,
                )
                .join(
                    Lawn,
                    and_(
                        Lawn.location_id == Location.id, Lawn.weather_enabled.is_(True)
                    ),
                )
                .group_by(Location.id, Location.latitude, Location.longitude)
            )

            for loc in session.execute(stmt):
                try:
                    _update_recent_weather_for_location_sync(
                        loc.location_id, loc.latitude, loc.longitude
                    )
                except (requests.exceptions.RequestException, SQLAlchemyError) as e:
                    logger.error(
                        f"[{task_id}] Weather update failed for location "
                        f"{loc.location_id}: {e}"
                    )
                except Exception as e:
                    logger.error(
                        f"[{task_id}] Unexpected error updating location "
                        f"{loc.location_id}: {e}"
                    )

            # Create task status record for success
            create_or_update_task_status_sync(
                session,
                task_id,
                "update_weather_for_all_lawns",
                None,  # No specific location_id for this task
                TaskStatusEnum.success,
                finished=True,
            )

    except (requests.exceptions.RequestException, SQLAlchemyError) as e:
        logger.error(f"All-lawn weather update task failed: {e}")
        try:
            with SessionLocal() as session:
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "update_weather_for_all_lawns",
                    None,  # No specific location_id for this task
                    TaskStatusEnum.failure,
                    error=str(e),
                    finished=True,
                )
        except SQLAlchemyError:
            # Cannot update task status if DB is down, Celery will retry
            pass
        raise
    except Exception as e:
        logger.error(
            f"An unexpected error occurred in all-lawn weather update task: {e}"
        )
        try:
            with SessionLocal() as session:
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "update_weather_for_all_lawns",
                    None,  # No specific location_id for this task
                    TaskStatusEnum.failure,
                    error="An unexpected error occurred.",
                    finished=True,
                )
        except SQLAlchemyError:
            # Cannot update task status if DB is down, Celery will retry
            pass
        raise


@app.task(name="recalculate_gdd_for_location", bind=True)
def recalculate_gdd_for_location(self, location_id: int):
    """
    Recalculates GDD for all models associated with a given location.
    Triggered after weather data is updated.
    """
    task_id = self.request.id
    try:
        with SessionLocal() as session:
            # Create task status record for start
            create_or_update_task_status_sync(
                session,
                task_id,
                "recalculate_gdd_for_location",
                location_id,
                TaskStatusEnum.started,
                started=True,
            )

            # Find all GDD models for the given location_id
            stmt = select(GDDModel).where(GDDModel.location_id == location_id)
            result = session.execute(stmt)
            gdd_models = result.scalars().all()

            for model in gdd_models:
                try:
                    calculate_and_store_gdd_values_sync_segmented(
                        session, model.id, location_id
                    )
                except Exception as e:
                    logger.error(
                        f"Failed to recalculate GDD for model {model.id} at location {location_id}: {e}"
                    )
                    # Log and continue

            # Create task status record for success
            create_or_update_task_status_sync(
                session,
                task_id,
                "recalculate_gdd_for_location",
                location_id,
                TaskStatusEnum.success,
                finished=True,
            )

    except SQLAlchemyError as e:
        logger.critical(
            f"Database connection failed for GDD recalculation task for loc {location_id}: {e}"
        )
        try:
            with SessionLocal() as session:
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "recalculate_gdd_for_location",
                    location_id,
                    TaskStatusEnum.failure,
                    error=str(e),
                    finished=True,
                )
        except SQLAlchemyError:
            # Cannot update task status if DB is down, Celery will retry
            pass
        raise
    except Exception as e:
        logger.error(
            f"An unexpected error occurred in GDD recalculation task for loc {location_id}: {e}"
        )
        try:
            with SessionLocal() as session:
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "recalculate_gdd_for_location",
                    location_id,
                    TaskStatusEnum.failure,
                    error="An unexpected error occurred.",
                    finished=True,
                )
        except SQLAlchemyError:
            # Cannot update task status if DB is down, Celery will retry
            pass
        raise

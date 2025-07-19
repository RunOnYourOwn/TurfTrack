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
from app.utils.disease import calculate_smith_kerns_for_location
import math
from app.utils.growth_potential import calculate_growth_potential_for_location
from sqlalchemy.dialects.postgresql import insert
from app.core.logging_config import log_performance_metric
import time
from app.models.daily_weather import DailyWeather

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
    request_id: str = None,  # New argument
):
    now = datetime.datetime.now(datetime.timezone.utc)
    insert_stmt = insert(TaskStatus).values(
        task_id=task_id,
        task_name=task_name,
        related_location_id=location_id,
        status=status,
        started_at=now if started else None,
        finished_at=now if finished else None,
        error=error,
        request_id=request_id,  # Save request_id
    )
    update_dict = {
        "status": status,
        "task_name": task_name,
        "related_location_id": location_id,
        "request_id": request_id,  # Save request_id
    }
    if started:
        update_dict["started_at"] = now
    if finished:
        update_dict["finished_at"] = now
    if error:
        update_dict["error"] = error
    upsert_stmt = insert_stmt.on_conflict_do_update(
        index_elements=["task_id"],
        set_=update_dict,
    )
    session.execute(upsert_stmt)
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
    request_id=None,  # New argument
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
            request_id=request_id,  # Save request_id
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
        if request_id:
            task_status.request_id = request_id
    await session.commit()


@app.task(name="fetch_and_store_weather", bind=True)
def fetch_and_store_weather(self, location_id: int, latitude: float, longitude: float):
    print(f"[DEBUG] fetch_and_store_weather task started for location {location_id}")
    logger.info(
        f"[fetch_and_store_weather] Task {self.request.id} started for location {location_id}"
    )
    task_id = self.request.id
    request_id = (
        self.request.headers.get("request_id")
        if hasattr(self.request, "headers") and self.request.headers
        else None
    )
    print(f"[DEBUG] Task ID: {task_id}, Request ID: {request_id}")

    try:
        with SessionLocal() as session:
            print(f"[DEBUG] Database session created for location {location_id}")
            try:
                print(f"[DEBUG] Creating task status record for location {location_id}")
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "fetch_and_store_weather",
                    location_id,
                    TaskStatusEnum.started,
                    started=True,
                    request_id=request_id,
                )
                print(
                    f"[DEBUG] Task status updated to started for location {location_id}"
                )

                print(f"[DEBUG] Starting weather fetch for location {location_id}")
                _fetch_and_store_weather_sync(location_id, latitude, longitude, session)
                print(f"[DEBUG] Weather fetch completed for location {location_id}")

                print(
                    f"[DEBUG] Updating task status to success for location {location_id}"
                )
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "fetch_and_store_weather",
                    location_id,
                    TaskStatusEnum.success,
                    finished=True,
                    request_id=request_id,
                )
                print(
                    f"[DEBUG] Task status updated to success for location {location_id}"
                )
                logger.info(
                    f"[fetch_and_store_weather] Task {task_id} completed successfully for location {location_id}"
                )

            except (requests.exceptions.RequestException, SQLAlchemyError) as e:
                print(f"[DEBUG] Error in weather task for location {location_id}: {e}")
                logger.error(
                    f"Weather task failed for loc {location_id}: {e}",
                    extra={"request_id": request_id},
                )
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "fetch_and_store_weather",
                    location_id,
                    TaskStatusEnum.failure,
                    error=str(e),
                    finished=True,
                    request_id=request_id,
                )
                raise
            except Exception as e:
                print(
                    f"[DEBUG] Unexpected error in weather task for location {location_id}: {e}"
                )
                logger.error(
                    f"An unexpected error occurred in weather task for loc {location_id}: {e}",
                    extra={"request_id": request_id},
                )
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "fetch_and_store_weather",
                    location_id,
                    TaskStatusEnum.failure,
                    error="An unexpected error occurred.",
                    finished=True,
                    request_id=request_id,
                )
                raise
    except SQLAlchemyError as e:
        print(f"[DEBUG] Database connection failed for weather task: {e}")
        logger.critical(
            f"Database connection failed for weather task: {e}",
            extra={"request_id": request_id},
        )
        # Cannot update task status if DB is down, Celery will retry
        raise


def _sanitize(value, default_for_not_null=None):
    try:
        f = float(value)
        if math.isnan(f) or math.isinf(f):
            return default_for_not_null
        return f
    except Exception:
        return default_for_not_null


def _extract_weather_data(daily, i, date=None):
    # Log raw and sanitized value for relative_humidity_2m_mean
    raw_rh = daily.Variables(8).ValuesAsNumpy()[i]
    sanitized_rh = _sanitize(raw_rh)
    # Log raw and sanitized value for precipitation_mm
    raw_precip = daily.Variables(2).ValuesAsNumpy()[i]
    sanitized_precip = _sanitize(raw_precip)

    # Add comprehensive logging for debugging
    if date is not None:
        print(
            f"[WeatherIngest] Date: {date}, raw RH: {raw_rh}, sanitized RH: {sanitized_rh}, raw Precip: {raw_precip}, sanitized Precip: {sanitized_precip}"
        )

        # Log all raw values for this date
        print(f"[WeatherIngest] Raw values for {date}:")
        for var_idx in range(daily.VariablesLength()):
            try:
                var_name = daily.Variables(var_idx).Name()
                var_value = daily.Variables(var_idx).ValuesAsNumpy()[i]
                print(
                    f"  Variable {var_idx} ({var_name}): {var_value} (type: {type(var_value)})"
                )
            except Exception as e:
                print(f"  Variable {var_idx}: ERROR - {e}")

    data = {
        # NOT NULL fields - provide sensible defaults for NaN values
        "temperature_max_c": _sanitize(daily.Variables(0).ValuesAsNumpy()[i], 0.0),
        "temperature_max_f": _sanitize(
            daily.Variables(0).ValuesAsNumpy()[i] * 9 / 5 + 32, 32.0
        ),
        "temperature_min_c": _sanitize(daily.Variables(1).ValuesAsNumpy()[i], 0.0),
        "temperature_min_f": _sanitize(
            daily.Variables(1).ValuesAsNumpy()[i] * 9 / 5 + 32, 32.0
        ),
        "precipitation_mm": _sanitize(daily.Variables(2).ValuesAsNumpy()[i], 0.0),
        "precipitation_in": _sanitize(
            daily.Variables(2).ValuesAsNumpy()[i] / 25.4, 0.0
        ),
        "precipitation_probability_max": _sanitize(
            daily.Variables(3).ValuesAsNumpy()[i], 0.0
        ),
        "wind_speed_max_ms": _sanitize(daily.Variables(4).ValuesAsNumpy()[i], 0.0),
        "wind_speed_max_mph": _sanitize(
            daily.Variables(4).ValuesAsNumpy()[i] * 2.237, 0.0
        ),
        "wind_gusts_max_ms": _sanitize(daily.Variables(5).ValuesAsNumpy()[i], 0.0),
        "wind_gusts_max_mph": _sanitize(
            daily.Variables(5).ValuesAsNumpy()[i] * 2.237, 0.0
        ),
        "wind_direction_dominant_deg": _sanitize(
            daily.Variables(6).ValuesAsNumpy()[i], 0.0
        ),
        "et0_evapotranspiration_mm": _sanitize(
            daily.Variables(7).ValuesAsNumpy()[i], 0.0
        ),
        "et0_evapotranspiration_in": _sanitize(
            daily.Variables(7).ValuesAsNumpy()[i] / 25.4, 0.0
        ),
        # Nullable fields - can be None
        "relative_humidity_mean": _sanitize(daily.Variables(8).ValuesAsNumpy()[i]),
        "relative_humidity_max": _sanitize(daily.Variables(9).ValuesAsNumpy()[i]),
        "relative_humidity_min": _sanitize(daily.Variables(10).ValuesAsNumpy()[i]),
        "dew_point_max_c": _sanitize(daily.Variables(11).ValuesAsNumpy()[i]),
        "dew_point_max_f": _sanitize(
            daily.Variables(11).ValuesAsNumpy()[i] * 9 / 5 + 32
        ),
        "dew_point_min_c": _sanitize(daily.Variables(12).ValuesAsNumpy()[i]),
        "dew_point_min_f": _sanitize(
            daily.Variables(12).ValuesAsNumpy()[i] * 9 / 5 + 32
        ),
        "dew_point_mean_c": _sanitize(daily.Variables(13).ValuesAsNumpy()[i]),
        "dew_point_mean_f": _sanitize(
            daily.Variables(13).ValuesAsNumpy()[i] * 9 / 5 + 32
        ),
        "sunshine_duration_s": _sanitize(daily.Variables(14).ValuesAsNumpy()[i]),
        "sunshine_duration_h": _sanitize(daily.Variables(14).ValuesAsNumpy()[i] / 3600),
    }
    return data


def _get_dates(daily):
    import pandas as pd

    dates = pd.date_range(
        start=pd.to_datetime(daily.Time(), unit="s"),
        end=pd.to_datetime(daily.TimeEnd(), unit="s"),
        freq=pd.Timedelta(seconds=daily.Interval()),
        inclusive="left",
    )
    return dates


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

    # Time the weather API call
    start_time = time.time()
    try:
        responses = om.weather_api(
            "https://api.open-meteo.com/v1/forecast", params=params
        )
        response = responses[0]
        daily = response.Daily()
        duration_ms = (time.time() - start_time) * 1000
        log_performance_metric(
            "weather_api_call",
            duration_ms,
            success=True,
            location_id=location_id,
            api_endpoint="openmeteo_forecast",
        )

        # Debug logging
        dates = _get_dates(daily)
        print(f"[DEBUG] API returned {len(dates)} dates")
        print(f"DEBUG] Date range: {dates[0].date()} to {dates[-1].date()}")

    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        log_performance_metric(
            "weather_api_call",
            duration_ms,
            success=False,
            location_id=location_id,
            api_endpoint="openmeteo_forecast",
            error=str(e),
        )
        raise

    # Build and upsert data
    for i, date in enumerate(_get_dates(daily)):
        data = _extract_weather_data(daily, i, date)
        weather_type = (
            WeatherType.historical if date.date() < today else WeatherType.forecast
        )
        upsert_daily_weather_sync(session, location_id, date, weather_type, data)

        # Calculate disease pressure for this location (Smith-Kerns)
        forecast_end = today + datetime.timedelta(days=16)
        calculate_smith_kerns_for_location(
            session, location_id, today - datetime.timedelta(days=60), forecast_end
        )
        # Calculate weed pressure for this location (same date range)
        from app.utils.weed_pressure import calculate_weed_pressure_for_location_range

        calculate_weed_pressure_for_location_range(
            session, location_id, today - datetime.timedelta(days=60), forecast_end
        )
        # Calculate growth potential for this location (same date range)
        calculate_growth_potential_for_location(
            session, location_id, today - datetime.timedelta(days=60), forecast_end
        )


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

        # Time the historical weather API call
        start_time = time.time()
        try:
            responses_hist = om.weather_api(
                "https://api.open-meteo.com/v1/forecast", params=params_hist
            )
            response_hist = responses_hist[0]
            daily_hist = response_hist.Daily()
            duration_ms = (time.time() - start_time) * 1000
            log_performance_metric(
                "weather_api_call",
                duration_ms,
                success=True,
                location_id=location_id,
                api_endpoint="openmeteo_historical",
            )
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            log_performance_metric(
                "weather_api_call",
                duration_ms,
                success=False,
                location_id=location_id,
                api_endpoint="openmeteo_historical",
                error=str(e),
            )
            raise

        for i, date in enumerate(_get_dates(daily_hist)):
            data = _extract_weather_data(daily_hist, i, date)
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

        # Time the forecast weather API call
        start_time = time.time()
        try:
            responses_forecast = om.weather_api(
                "https://api.open-meteo.com/v1/forecast", params=params_forecast
            )
            response_forecast = responses_forecast[0]
            daily_forecast = response_forecast.Daily()
            duration_ms = (time.time() - start_time) * 1000
            log_performance_metric(
                "weather_api_call",
                duration_ms,
                success=True,
                location_id=location_id,
                api_endpoint="openmeteo_forecast",
            )
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            log_performance_metric(
                "weather_api_call",
                duration_ms,
                success=False,
                location_id=location_id,
                api_endpoint="openmeteo_forecast",
                error=str(e),
            )
            raise

        for i, date in enumerate(_get_dates(daily_forecast)):
            data = _extract_weather_data(daily_forecast, i, date)
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

        # Calculate disease pressure for this location (Smith-Kerns)
        # Only recalculate yesterday (when forecast becomes historical) and new forecast days
        yesterday = today - datetime.timedelta(days=1)
        forecast_end = today + datetime.timedelta(days=16)
        calculate_smith_kerns_for_location(
            session, location_id, yesterday, forecast_end
        )
        # Calculate weed pressure for this location (same optimized date range)
        from app.utils.weed_pressure import calculate_weed_pressure_for_location_range

        calculate_weed_pressure_for_location_range(
            session, location_id, yesterday, forecast_end
        )
        # Calculate growth potential for this location (same optimized date range)
        calculate_growth_potential_for_location(
            session, location_id, yesterday, forecast_end
        )


@app.task(name="update_weather_for_all_lawns", bind=True)
def update_weather_for_all_lawns(self):
    logger.info(f"[update_weather_for_all_lawns] Task {self.request.id} started")
    try:
        with SessionLocal() as session:
            print("Database session created successfully")
            # Update task status to started (upsert)
            create_or_update_task_status_sync(
                session,
                self.request.id,
                "update_weather_for_all_lawns",
                None,  # No specific location for this task
                TaskStatusEnum.started,
                started=True,
                request_id=self.request.headers.get("request_id")
                if hasattr(self.request, "headers") and self.request.headers
                else None,
            )
            print("Task status record updated to started")

            # Get all locations that have at least one lawn with weather enabled
            locations_with_weather = (
                session.query(Location)
                .join(Lawn)
                .filter(Lawn.weather_enabled)
                .distinct()
                .all()
            )
            print(f"Found {len(locations_with_weather)} locations with weather enabled")

            if not locations_with_weather:
                print("No locations with weather enabled found")
                task_status = (
                    session.query(TaskStatus)
                    .filter(TaskStatus.task_id == self.request.id)
                    .first()
                )
                if task_status:
                    task_status.status = TaskStatusEnum.success
                    task_status.result = "No locations with weather enabled"
                    task_status.finished_at = datetime.datetime.now(
                        datetime.timezone.utc
                    )
                    session.commit()
                logger.info(
                    f"[update_weather_for_all_lawns] Task {self.request.id} completed: No locations with weather enabled"
                )
                return "No locations with weather enabled"

            print(
                f"[DEBUG] Starting to process {len(locations_with_weather)} locations"
            )
            # Process each location
            for location in locations_with_weather:
                print(f"[DEBUG] Processing location {location.id})")
                print(f"Processing location:{location.name} (ID: {location.id})")
                try:
                    print(
                        f"[DEBUG] About to queue weather fetch for location {location.id}"
                    )
                    # Use optimized function for daily updates
                    _update_recent_weather_for_location_sync(
                        location.id, location.latitude, location.longitude
                    )
                    print(
                        f"[DEBUG] Successfully updated weather for location {location.id}"
                    )
                    logger.info(
                        f"[update_weather_for_all_lawns] Updated weather for location {location.id}"
                    )
                except Exception as e:
                    print(
                        f"[DEBUG] Error queuing weather fetch for location {location.id}: {e}"
                    )
                    logger.error(
                        f"Error queuing weather fetch for location {location.id}: {e}"
                    )

            # Update task status
            task_status = (
                session.query(TaskStatus)
                .filter(TaskStatus.task_id == self.request.id)
                .first()
            )
            if task_status:
                task_status.status = TaskStatusEnum.success
                task_status.result = (
                    f"Processed {len(locations_with_weather)} locations"
                )
                task_status.finished_at = datetime.datetime.now(datetime.timezone.utc)
                session.commit()
            logger.info(
                f"[update_weather_for_all_lawns] Task {self.request.id} completed successfully: Processed {len(locations_with_weather)} locations"
            )
            print("Task completed successfully")
            return f"Processed {len(locations_with_weather)} locations"
    except Exception as e:
        import traceback

        logger.error(
            f"[update_weather_for_all_lawns] Task {self.request.id} failed: {e}\n{traceback.format_exc()}"
        )
        print(f"Error in update_weather_for_all_lawns: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        # Update task status with error
        try:
            with SessionLocal() as session:
                task_status = (
                    session.query(TaskStatus)
                    .filter(TaskStatus.task_id == self.request.id)
                    .first()
                )
                if task_status:
                    task_status.status = TaskStatusEnum.failure
                    task_status.error = str(e)
                    task_status.finished_at = datetime.datetime.now(
                        datetime.timezone.utc
                    )
                    session.commit()
        except Exception as update_error:
            logger.error(
                f"[update_weather_for_all_lawns] Error updating task status after failure: {update_error}"
            )
            print(f"Error updating task status: {update_error}")
        raise


@app.task(name="recalculate_gdd_for_location", bind=True)
def recalculate_gdd_for_location(self, location_id: int):
    """
    Recalculates GDD for all models associated with a given location.
    Triggered after weather data is updated.
    """
    task_id = self.request.id
    request_id = self.request.headers.get("request_id")
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
                request_id=request_id,
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
                        f"Failed to recalculate GDD for model {model.id} at location {location_id}: {e}",
                        extra={"request_id": request_id},
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
                request_id=request_id,
            )

    except SQLAlchemyError as e:
        logger.critical(
            f"Database connection failed for GDD recalculation task for loc {location_id}: {e}",
            extra={"request_id": request_id},
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
                    request_id=request_id,
                )
        except SQLAlchemyError:
            # Cannot update task status if DB is down, Celery will retry
            pass
        raise
    except Exception as e:
        logger.error(
            f"An unexpected error occurred in GDD recalculation task for loc {location_id}: {e}",
            extra={"request_id": request_id},
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
                    request_id=request_id,
                )
        except SQLAlchemyError:
            # Cannot update task status if DB is down, Celery will retry
            pass
        raise


@app.task(name="backfill_weather_for_location", bind=True)
def backfill_weather_for_location(
    self, location_id: int, start_date: str, end_date: str
):
    """
    Backfill weather data for a specific location and date range.
    Marks each date as historical (if before today) or forecast (if today or later).
    Tracks progress in TaskStatus.
    """
    import pandas as pd
    from app.utils.weather import upsert_daily_weather_sync
    from app.models.daily_weather import WeatherType
    from app.models.task_status import TaskStatusEnum

    task_id = self.request.id
    request_id = self.request.headers.get("request_id")
    try:
        with SessionLocal() as session:
            # TaskStatus: started
            create_or_update_task_status_sync(
                session,
                task_id,
                "backfill_weather_for_location",
                location_id,
                TaskStatusEnum.started,
                started=True,
                request_id=request_id,
            )
            # Look up location
            loc = session.execute(
                select(Location).where(Location.id == location_id)
            ).scalar_one_or_none()
            if not loc:
                raise ValueError(f"Location {location_id} not found")
            latitude = loc.latitude
            longitude = loc.longitude

            # Parse dates
            start = pd.to_datetime(start_date).date()
            end = pd.to_datetime(end_date).date()
            today = datetime.date.today()

            # Fetch weather data for the range
            om = openmeteo_requests.Client()
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
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
            responses = om.weather_api(
                "https://api.open-meteo.com/v1/forecast", params=params
            )
            response = responses[0]
            daily = response.Daily()
            dates = _get_dates(daily)
            for i, date in enumerate(dates):
                data = _extract_weather_data(daily, i, date)
                weather_type = (
                    WeatherType.historical
                    if date.date() < today
                    else WeatherType.forecast
                )
                upsert_daily_weather_sync(
                    session, location_id, date, weather_type, data
                )

            # TaskStatus: success
            create_or_update_task_status_sync(
                session,
                task_id,
                "backfill_weather_for_location",
                location_id,
                TaskStatusEnum.success,
                finished=True,
                request_id=request_id,
            )

    except Exception as e:
        logger.error(
            f"Backfill weather task failed for location {location_id}: {e}",
            extra={"request_id": request_id},
        )
        try:
            with SessionLocal() as session:
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "backfill_weather_for_location",
                    location_id,
                    TaskStatusEnum.failure,
                    error=str(e),
                    finished=True,
                    request_id=request_id,
                )
        except Exception:
            pass
        raise


@app.task(name="backfill_gdd_for_model", bind=True)
def backfill_gdd_for_model(self, gdd_model_id: int):
    """
    Recalculate all GDD values for a given GDD model (full history backfill).
    Tracks progress in TaskStatus.
    Ensures model has proper parameter history and reset records before calculation.
    """
    from app.models.task_status import TaskStatusEnum
    from app.models.gdd import GDDReset, ResetType, GDDModelParameters
    from app.utils.gdd import store_parameter_history

    task_id = self.request.id
    request_id = self.request.headers.get("request_id")
    try:
        with SessionLocal() as session:
            # Look up GDD model and location first
            gdd_model = session.get(GDDModel, gdd_model_id)
            if not gdd_model:
                raise ValueError(f"GDD model {gdd_model_id} not found")
            location_id = gdd_model.location_id

            # TaskStatus: started
            create_or_update_task_status_sync(
                session,
                task_id,
                "backfill_gdd_for_model",
                location_id,  # Use the actual location_id, not gdd_model_id
                TaskStatusEnum.started,
                started=True,
                request_id=request_id,
            )

            # Ensure parameter history exists (like model creation does)
            existing_params = (
                session.query(GDDModelParameters)
                .filter(GDDModelParameters.gdd_model_id == gdd_model_id)
                .first()
            )

            if not existing_params:
                # Store initial parameters in history (same as model creation)
                store_parameter_history(
                    session,
                    gdd_model_id,
                    gdd_model.base_temp,
                    gdd_model.threshold,
                    gdd_model.reset_on_threshold,
                    gdd_model.start_date,
                )

            # Ensure initial reset exists (like model creation does)
            existing_reset = (
                session.query(GDDReset)
                .filter(
                    GDDReset.gdd_model_id == gdd_model_id,
                    GDDReset.reset_type == ResetType.initial,
                )
                .first()
            )

            if not existing_reset:
                # Create initial reset (same as model creation)
                initial_reset = GDDReset(
                    gdd_model_id=gdd_model_id,
                    reset_date=gdd_model.start_date,
                    run_number=1,
                    reset_type=ResetType.initial,
                )
                session.add(initial_reset)
                session.commit()

            # Recalculate all GDD values
            calculate_and_store_gdd_values_sync_segmented(
                session, gdd_model_id, location_id
            )

            # TaskStatus: success
            create_or_update_task_status_sync(
                session,
                task_id,
                "backfill_gdd_for_model",
                location_id,  # Use the actual location_id, not gdd_model_id
                TaskStatusEnum.success,
                finished=True,
                request_id=request_id,
            )
    except Exception as e:
        logger.error(
            f"Backfill GDD task failed for model {gdd_model_id}: {e}",
            extra={"request_id": request_id},
        )
        try:
            with SessionLocal() as session:
                # Try to get location_id for error reporting
                gdd_model = session.get(GDDModel, gdd_model_id)
                location_id = gdd_model.location_id if gdd_model else None

                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "backfill_gdd_for_model",
                    location_id,  # Use the actual location_id, not gdd_model_id
                    TaskStatusEnum.failure,
                    error=str(e),
                    finished=True,
                    request_id=request_id,
                )
        except Exception:
            pass
        raise


@app.task(name="backfill_disease_pressure_for_location", bind=True)
def backfill_disease_pressure_for_location(
    self, location_id: int, start_date: str, end_date: str
):
    """
    Recalculate disease pressure for a location and date range.
    Tracks progress in TaskStatus.
    """
    from app.models.task_status import TaskStatusEnum
    import pandas as pd

    task_id = self.request.id
    request_id = self.request.headers.get("request_id")
    try:
        with SessionLocal() as session:
            # TaskStatus: started
            create_or_update_task_status_sync(
                session,
                task_id,
                "backfill_disease_pressure_for_location",
                location_id,
                TaskStatusEnum.started,
                started=True,
                request_id=request_id,
            )
            # Parse dates
            start = pd.to_datetime(start_date).date()
            end = pd.to_datetime(end_date).date()
            # Recalculate disease pressure for the range
            calculate_smith_kerns_for_location(session, location_id, start, end)
            # TaskStatus: success
            create_or_update_task_status_sync(
                session,
                task_id,
                "backfill_disease_pressure_for_location",
                location_id,
                TaskStatusEnum.success,
                finished=True,
                request_id=request_id,
            )
    except Exception as e:
        logger.error(
            f"Backfill disease pressure task failed for location {location_id}: {e}",
            extra={"request_id": request_id},
        )
        try:
            with SessionLocal() as session:
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "backfill_disease_pressure_for_location",
                    location_id,
                    TaskStatusEnum.failure,
                    error=str(e),
                    finished=True,
                    request_id=request_id,
                )
        except Exception:
            pass
        raise


@app.task(name="backfill_growth_potential_for_location", bind=True)
def backfill_growth_potential_for_location(
    self, location_id: int, start_date: str, end_date: str
):
    """
    Recalculate growth potential for a location and date range.
    Tracks progress in TaskStatus.
    """
    from app.models.task_status import TaskStatusEnum
    import pandas as pd

    task_id = self.request.id
    request_id = self.request.headers.get("request_id")
    try:
        with SessionLocal() as session:
            # TaskStatus: started
            create_or_update_task_status_sync(
                session,
                task_id,
                "backfill_growth_potential_for_location",
                location_id,
                TaskStatusEnum.started,
                started=True,
                request_id=request_id,
            )
            # Parse dates
            start = pd.to_datetime(start_date).date()
            end = pd.to_datetime(end_date).date()
            # Recalculate growth potential for the range
            calculate_growth_potential_for_location(session, location_id, start, end)
            # TaskStatus: success
            create_or_update_task_status_sync(
                session,
                task_id,
                "backfill_growth_potential_for_location",
                location_id,
                TaskStatusEnum.success,
                finished=True,
                request_id=request_id,
            )
    except Exception as e:
        logger.error(
            f"Backfill growth potential task failed for location {location_id}: {e}",
            extra={"request_id": request_id},
        )
        try:
            with SessionLocal() as session:
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "backfill_growth_potential_for_location",
                    location_id,
                    TaskStatusEnum.failure,
                    error=str(e),
                    finished=True,
                    request_id=request_id,
                )
        except Exception:
            pass
        raise


@app.task(name="cleanup_duplicate_weather_for_location", bind=True)
def cleanup_duplicate_weather_for_location(self, location_id: int):
    """
    Clean up duplicate weather entries for a location.
    When both historical and forecast data exist for the same date,
    keeps the historical data and removes the forecast data.
    Tracks progress in TaskStatus.
    """
    from app.models.task_status import TaskStatusEnum
    from app.models.daily_weather import WeatherType
    from sqlalchemy import func

    task_id = self.request.id
    request_id = self.request.headers.get("request_id")
    try:
        with SessionLocal() as session:
            # TaskStatus: started
            create_or_update_task_status_sync(
                session,
                task_id,
                "cleanup_duplicate_weather_for_location",
                location_id,
                TaskStatusEnum.started,
                started=True,
                request_id=request_id,
            )

            # Find dates that have multiple entries
            duplicate_dates_query = (
                session.query(DailyWeather.date)
                .filter(DailyWeather.location_id == location_id)
                .group_by(DailyWeather.date)
                .having(func.count(DailyWeather.date) > 1)
            )
            duplicate_dates = duplicate_dates_query.all()

            cleaned_count = 0
            for (weather_date,) in duplicate_dates:
                # Get all entries for this date
                entries = (
                    session.query(DailyWeather)
                    .filter(
                        DailyWeather.location_id == location_id,
                        DailyWeather.date == weather_date,
                    )
                    .order_by(
                        DailyWeather.type.asc()
                    )  # historical comes before forecast
                    .all()
                )

                if len(entries) > 1:
                    # Check if we have both historical and forecast
                    types = [entry.type for entry in entries]
                    if (
                        WeatherType.historical in types
                        and WeatherType.forecast in types
                    ):
                        # Keep historical, remove forecast
                        forecast_entries = [
                            entry
                            for entry in entries
                            if entry.type == WeatherType.forecast
                        ]
                        for entry in forecast_entries:
                            session.delete(entry)
                            cleaned_count += 1

            session.commit()

            # TaskStatus: success
            create_or_update_task_status_sync(
                session,
                task_id,
                "cleanup_duplicate_weather_for_location",
                location_id,
                TaskStatusEnum.success,
                finished=True,
                request_id=request_id,
            )

            logger.info(
                f"Cleaned up {cleaned_count} duplicate weather entries for location {location_id}",
                extra={"request_id": request_id},
            )

    except Exception as e:
        logger.error(
            f"Cleanup duplicate weather task failed for location {location_id}: {e}",
            extra={"request_id": request_id},
        )
        try:
            with SessionLocal() as session:
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "cleanup_duplicate_weather_for_location",
                    location_id,
                    TaskStatusEnum.failure,
                    error=str(e),
                    finished=True,
                    request_id=request_id,
                )
        except Exception:
            pass
        raise

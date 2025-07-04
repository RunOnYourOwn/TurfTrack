from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.daily_weather import DailyWeather, WeatherType
import datetime
from sqlalchemy import exists
import logging
import uuid
from app.models.lawn import Lawn
from app.models.task_status import TaskStatus, TaskStatusEnum
from app.tasks.weather import fetch_and_store_weather


async def trigger_weather_fetch_if_needed(db: AsyncSession, lawn: Lawn):
    """
    Checks if a weather fetch is needed for a lawn's location and triggers it.

    A fetch is needed if weather is enabled for the lawn and no weather data
    currently exists for its location. If not needed, it creates a success
    task status record for visibility in the UI.
    """
    if not lawn.weather_enabled:
        return

    # A location object should be loaded on the lawn object before calling this
    if not lawn.location:
        await db.refresh(lawn, attribute_names=["location"])

    weather_exists = await db.execute(
        select(exists().where(DailyWeather.location_id == lawn.location_id))
    )

    logger = logging.getLogger("turftrack.weather_util")

    if not weather_exists.scalar():
        logger.info(
            f"No weather data found for location_id={lawn.location_id}. Triggering fetch_and_store_weather."
        )
        fetch_and_store_weather.delay(
            lawn.location_id, lawn.location.latitude, lawn.location.longitude
        )
    else:
        logger.info(
            f"Weather data already exists for location_id={lawn.location_id}. No fetch needed."
        )
        # Create a TaskStatus record to indicate weather already exists for clarity in the UI
        now = datetime.datetime.now(datetime.timezone.utc)
        task_status = TaskStatus(
            task_id=str(uuid.uuid4()),
            task_name="fetch_and_store_weather",
            related_location_id=lawn.location_id,
            status=TaskStatusEnum.success,
            created_at=now,
            started_at=now,
            finished_at=now,
            result="Weather data for this location already exists. No new fetch was needed.",
        )
        db.add(task_status)
        await db.commit()


async def upsert_daily_weather(
    session: AsyncSession, location_id: int, date, type: WeatherType, data: dict
):
    # Upsert the daily weather record
    result = await session.execute(
        select(DailyWeather).where(
            DailyWeather.location_id == location_id,
            DailyWeather.date == date,
            DailyWeather.type == type,
        )
    )
    existing = result.scalars().first()
    if existing:
        for key, value in data.items():
            setattr(existing, key, value)
    else:
        weather = DailyWeather(location_id=location_id, date=date, type=type, **data)
        session.add(weather)
    await session.commit()

    # If this is a new historical record, delete any forecast for this date/location
    if type == WeatherType.historical:
        await session.execute(
            DailyWeather.__table__.delete().where(
                (DailyWeather.location_id == location_id)
                & (DailyWeather.date == date)
                & (DailyWeather.type == WeatherType.forecast.value)
            )
        )
        await session.commit()


def upsert_daily_weather_sync(
    session,
    location_id: int,
    date: datetime.date,
    weather_type: WeatherType,
    data: dict,
):
    from sqlalchemy import text
    from app.models.daily_weather import DailyWeather

    # Single atomic upsert statement
    upsert_stmt = text("""
        INSERT INTO daily_weather (
            date, location_id, type,
            temperature_max_c, temperature_max_f,
            temperature_min_c, temperature_min_f,
            precipitation_mm, precipitation_in,
            precipitation_probability_max,
            wind_speed_max_ms, wind_speed_max_mph,
            wind_gusts_max_ms, wind_gusts_max_mph,
            wind_direction_dominant_deg,
            et0_evapotranspiration_mm, et0_evapotranspiration_in,
            relative_humidity_mean, relative_humidity_max, relative_humidity_min,
            dew_point_max_c, dew_point_max_f, dew_point_min_c, dew_point_min_f, dew_point_mean_c, dew_point_mean_f,
            sunshine_duration_s, sunshine_duration_h
        ) VALUES (
            :date, :location_id, :type,
            :temperature_max_c, :temperature_max_f,
            :temperature_min_c, :temperature_min_f,
            :precipitation_mm, :precipitation_in,
            :precipitation_probability_max,
            :wind_speed_max_ms, :wind_speed_max_mph,
            :wind_gusts_max_ms, :wind_gusts_max_mph,
            :wind_direction_dominant_deg,
            :et0_evapotranspiration_mm, :et0_evapotranspiration_in,
            :relative_humidity_mean, :relative_humidity_max, :relative_humidity_min,
            :dew_point_max_c, :dew_point_max_f, :dew_point_min_c, :dew_point_min_f, :dew_point_mean_c, :dew_point_mean_f,
            :sunshine_duration_s, :sunshine_duration_h
        )
        ON CONFLICT (date, location_id, type) DO UPDATE SET
            temperature_max_c = EXCLUDED.temperature_max_c,
            temperature_max_f = EXCLUDED.temperature_max_f,
            temperature_min_c = EXCLUDED.temperature_min_c,
            temperature_min_f = EXCLUDED.temperature_min_f,
            precipitation_mm = EXCLUDED.precipitation_mm,
            precipitation_in = EXCLUDED.precipitation_in,
            precipitation_probability_max = EXCLUDED.precipitation_probability_max,
            wind_speed_max_ms = EXCLUDED.wind_speed_max_ms,
            wind_speed_max_mph = EXCLUDED.wind_speed_max_mph,
            wind_gusts_max_ms = EXCLUDED.wind_gusts_max_ms,
            wind_gusts_max_mph = EXCLUDED.wind_gusts_max_mph,
            wind_direction_dominant_deg = EXCLUDED.wind_direction_dominant_deg,
            et0_evapotranspiration_mm = EXCLUDED.et0_evapotranspiration_mm,
            et0_evapotranspiration_in = EXCLUDED.et0_evapotranspiration_in,
            relative_humidity_mean = EXCLUDED.relative_humidity_mean,
            relative_humidity_max = EXCLUDED.relative_humidity_max,
            relative_humidity_min = EXCLUDED.relative_humidity_min,
            dew_point_max_c = EXCLUDED.dew_point_max_c,
            dew_point_max_f = EXCLUDED.dew_point_max_f,
            dew_point_min_c = EXCLUDED.dew_point_min_c,
            dew_point_min_f = EXCLUDED.dew_point_min_f,
            dew_point_mean_c = EXCLUDED.dew_point_mean_c,
            dew_point_mean_f = EXCLUDED.dew_point_mean_f,
            sunshine_duration_s = EXCLUDED.sunshine_duration_s,
            sunshine_duration_h = EXCLUDED.sunshine_duration_h
    """)

    params = {
        "date": date,
        "location_id": location_id,
        "type": weather_type.value,
        **data,
    }

    session.execute(upsert_stmt, params)
    session.commit()

    # If this is a new historical record, delete any forecast for this date/location
    if weather_type == WeatherType.historical:
        delete_stmt = text("""
            DELETE FROM daily_weather 
            WHERE location_id = :location_id 
            AND date = :date 
            AND type = :type
        """)
        session.execute(
            delete_stmt,
            {
                "location_id": location_id,
                "date": date,
                "type": WeatherType.forecast.value,
            },
        )
        session.commit()

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.daily_weather import DailyWeather, WeatherType
import datetime
from sqlalchemy import text


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
            et0_evapotranspiration_mm, et0_evapotranspiration_in
        ) VALUES (
            :date, :location_id, :type,
            :temperature_max_c, :temperature_max_f,
            :temperature_min_c, :temperature_min_f,
            :precipitation_mm, :precipitation_in,
            :precipitation_probability_max,
            :wind_speed_max_ms, :wind_speed_max_mph,
            :wind_gusts_max_ms, :wind_gusts_max_mph,
            :wind_direction_dominant_deg,
            :et0_evapotranspiration_mm, :et0_evapotranspiration_in
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
            et0_evapotranspiration_in = EXCLUDED.et0_evapotranspiration_in
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

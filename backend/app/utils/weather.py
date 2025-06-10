from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.daily_weather import DailyWeather, WeatherType


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
                & (DailyWeather.type == WeatherType.forecast)
            )
        )
        await session.commit()

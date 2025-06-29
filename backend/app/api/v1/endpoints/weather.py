from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.lawn import Lawn
from app.models.daily_weather import DailyWeather
from typing import Optional
from datetime import date, timedelta

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/lawn/{lawn_id}")
async def get_weather_for_lawn(
    lawn_id: int,
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    # Get the lawn and its location
    lawn = await db.get(Lawn, lawn_id)
    if not lawn:
        raise HTTPException(status_code=404, detail="Lawn not found")
    location_id = lawn.location_id

    # Default date range: last 30 days to next 16 days
    today = date.today()
    default_start = today - timedelta(days=30)
    default_end = today + timedelta(days=16)
    start = start_date or default_start
    end = end_date or default_end

    # Query daily_weather for this location and date range
    stmt = (
        select(DailyWeather)
        .where(
            DailyWeather.location_id == location_id,
            DailyWeather.date >= start,
            DailyWeather.date <= end,
        )
        .order_by(DailyWeather.date.asc())
    )
    result = await db.execute(stmt)
    weather_entries = result.scalars().all()

    # Serialize all fields
    def serialize(entry: DailyWeather):
        return {
            "date": entry.date.isoformat(),
            "type": entry.type.value,
            "temperature_max_c": entry.temperature_max_c,
            "temperature_max_f": entry.temperature_max_f,
            "temperature_min_c": entry.temperature_min_c,
            "temperature_min_f": entry.temperature_min_f,
            "precipitation_mm": entry.precipitation_mm,
            "precipitation_in": entry.precipitation_in,
            "precipitation_probability_max": entry.precipitation_probability_max,
            "wind_speed_max_ms": entry.wind_speed_max_ms,
            "wind_speed_max_mph": entry.wind_speed_max_mph,
            "wind_gusts_max_ms": entry.wind_gusts_max_ms,
            "wind_gusts_max_mph": entry.wind_gusts_max_mph,
            "wind_direction_dominant_deg": entry.wind_direction_dominant_deg,
            "et0_evapotranspiration_mm": entry.et0_evapotranspiration_mm,
            "et0_evapotranspiration_in": entry.et0_evapotranspiration_in,
        }

    return [serialize(e) for e in weather_entries]

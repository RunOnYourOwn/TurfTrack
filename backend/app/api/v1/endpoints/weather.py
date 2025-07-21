from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.lawn import Lawn
from app.models.daily_weather import DailyWeather
from typing import Optional
from datetime import date, timedelta
import math

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

    # Helper to sanitize float values
    def safe_float(val):
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return None
        return val

    # Serialize all fields
    def serialize(entry: DailyWeather):
        return {
            "date": entry.date.isoformat(),
            "type": entry.type.value,
            "temperature_max_c": safe_float(entry.temperature_max_c),
            "temperature_max_f": safe_float(entry.temperature_max_f),
            "temperature_min_c": safe_float(entry.temperature_min_c),
            "temperature_min_f": safe_float(entry.temperature_min_f),
            "precipitation_mm": safe_float(entry.precipitation_mm),
            "precipitation_in": safe_float(entry.precipitation_in),
            "precipitation_probability_max": safe_float(
                entry.precipitation_probability_max
            ),
            "wind_speed_max_ms": safe_float(entry.wind_speed_max_ms),
            "wind_speed_max_mph": safe_float(entry.wind_speed_max_mph),
            "wind_gusts_max_ms": safe_float(entry.wind_gusts_max_ms),
            "wind_gusts_max_mph": safe_float(entry.wind_gusts_max_mph),
            "wind_direction_dominant_deg": safe_float(
                entry.wind_direction_dominant_deg
            ),
            "et0_evapotranspiration_mm": safe_float(entry.et0_evapotranspiration_mm),
            "et0_evapotranspiration_in": safe_float(entry.et0_evapotranspiration_in),
            "relative_humidity_mean": safe_float(entry.relative_humidity_mean),
            "relative_humidity_max": safe_float(entry.relative_humidity_max),
            "relative_humidity_min": safe_float(entry.relative_humidity_min),
            "dew_point_max_c": safe_float(entry.dew_point_max_c),
            "dew_point_max_f": safe_float(entry.dew_point_max_f),
            "dew_point_min_c": safe_float(entry.dew_point_min_c),
            "dew_point_min_f": safe_float(entry.dew_point_min_f),
            "dew_point_mean_c": safe_float(entry.dew_point_mean_c),
            "dew_point_mean_f": safe_float(entry.dew_point_mean_f),
            "sunshine_duration_s": safe_float(entry.sunshine_duration_s),
            "sunshine_duration_h": safe_float(entry.sunshine_duration_h),
        }

    return [serialize(e) for e in weather_entries]


@router.get("/location/{location_id}")
async def get_weather_for_location(
    location_id: int,
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    # If either start_date or end_date is provided, use date filtering
    if start_date is not None or end_date is not None:
        today = date.today()
        default_start = today - timedelta(days=30)
        default_end = today + timedelta(days=16)
        start = start_date or default_start
        end = end_date or default_end
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
    else:
        # No date filters: return all data for this location
        stmt = (
            select(DailyWeather)
            .where(DailyWeather.location_id == location_id)
            .order_by(DailyWeather.date.asc())
        )
        result = await db.execute(stmt)
        weather_entries = result.scalars().all()

    # Helper to sanitize float values
    def safe_float(val):
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return None
        return val

    # Serialize all fields
    def serialize(entry: DailyWeather):
        return {
            "date": entry.date.isoformat(),
            "type": entry.type.value,
            "temperature_max_c": safe_float(entry.temperature_max_c),
            "temperature_max_f": safe_float(entry.temperature_max_f),
            "temperature_min_c": safe_float(entry.temperature_min_c),
            "temperature_min_f": safe_float(entry.temperature_min_f),
            "precipitation_mm": safe_float(entry.precipitation_mm),
            "precipitation_in": safe_float(entry.precipitation_in),
            "precipitation_probability_max": safe_float(
                entry.precipitation_probability_max
            ),
            "wind_speed_max_ms": safe_float(entry.wind_speed_max_ms),
            "wind_speed_max_mph": safe_float(entry.wind_speed_max_mph),
            "wind_gusts_max_ms": safe_float(entry.wind_gusts_max_ms),
            "wind_gusts_max_mph": safe_float(entry.wind_gusts_max_mph),
            "wind_direction_dominant_deg": safe_float(
                entry.wind_direction_dominant_deg
            ),
            "et0_evapotranspiration_mm": safe_float(entry.et0_evapotranspiration_mm),
            "et0_evapotranspiration_in": safe_float(entry.et0_evapotranspiration_in),
            "relative_humidity_mean": safe_float(entry.relative_humidity_mean),
            "relative_humidity_max": safe_float(entry.relative_humidity_max),
            "relative_humidity_min": safe_float(entry.relative_humidity_min),
            "dew_point_max_c": safe_float(entry.dew_point_max_c),
            "dew_point_max_f": safe_float(entry.dew_point_max_f),
            "dew_point_min_c": safe_float(entry.dew_point_min_c),
            "dew_point_min_f": safe_float(entry.dew_point_min_f),
            "dew_point_mean_c": safe_float(entry.dew_point_mean_c),
            "dew_point_mean_f": safe_float(entry.dew_point_mean_f),
            "sunshine_duration_s": safe_float(entry.sunshine_duration_s),
            "sunshine_duration_h": safe_float(entry.sunshine_duration_h),
        }

    return [serialize(e) for e in weather_entries]

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.lawn import Lawn
from app.models.disease_pressure import DiseasePressure
from app.schemas.disease_pressure import DiseasePressureList
from typing import List, Optional
from datetime import date, timedelta
from app.models.daily_weather import DailyWeather

router = APIRouter(prefix="/disease_pressure", tags=["disease_pressure"])


@router.get("/lawn/{lawn_id}", response_model=List[DiseasePressureList])
async def get_disease_pressure_for_lawn(
    lawn_id: int,
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    disease: Optional[str] = Query(
        None, description="Filter by disease type (e.g., 'smith_kerns')"
    ),
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

    # Build query
    query = select(DiseasePressure).where(
        DiseasePressure.location_id == location_id,
        DiseasePressure.date >= start,
        DiseasePressure.date <= end,
    )

    if disease:
        query = query.where(DiseasePressure.disease == disease)

    query = query.order_by(DiseasePressure.date.asc())

    result = await db.execute(query)
    disease_pressure_entries = result.scalars().all()

    # Batch fetch weather types for all dates
    dates = [dp.date for dp in disease_pressure_entries]
    if dates:
        weather_stmt = select(DailyWeather.date, DailyWeather.type).where(
            DailyWeather.location_id == location_id, DailyWeather.date.in_(dates)
        )
        weather_result = await db.execute(weather_stmt)
        weather_rows = weather_result.all()
        weather_type_map = {
            row[0]: row[1].value if hasattr(row[1], "value") else row[1]
            for row in weather_rows
        }
    else:
        weather_type_map = {}

    # Attach is_forecast to each disease pressure record
    enriched = []
    for dp in disease_pressure_entries:
        is_forecast = weather_type_map.get(dp.date) == "forecast"
        dp_dict = dp.__dict__.copy()
        dp_dict["is_forecast"] = is_forecast
        enriched.append(dp_dict)
    return enriched


@router.get("/location/{location_id}", response_model=List[DiseasePressureList])
async def get_disease_pressure_for_location(
    location_id: int,
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    disease: Optional[str] = Query(
        None, description="Filter by disease type (e.g., 'smith_kerns')"
    ),
    db: AsyncSession = Depends(get_db),
):
    # Default date range: last 30 days to next 16 days
    today = date.today()
    default_start = today - timedelta(days=30)
    default_end = today + timedelta(days=16)
    start = start_date or default_start
    end = end_date or default_end

    # Build query
    query = select(DiseasePressure).where(
        DiseasePressure.location_id == location_id,
        DiseasePressure.date >= start,
        DiseasePressure.date <= end,
    )

    if disease:
        query = query.where(DiseasePressure.disease == disease)

    query = query.order_by(DiseasePressure.date.asc())

    result = await db.execute(query)
    disease_pressure_entries = result.scalars().all()

    # Batch fetch weather types for all dates
    dates = [dp.date for dp in disease_pressure_entries]
    if dates:
        weather_stmt = select(DailyWeather.date, DailyWeather.type).where(
            DailyWeather.location_id == location_id, DailyWeather.date.in_(dates)
        )
        weather_result = await db.execute(weather_stmt)
        weather_rows = weather_result.all()
        weather_type_map = {
            row[0]: row[1].value if hasattr(row[1], "value") else row[1]
            for row in weather_rows
        }
    else:
        weather_type_map = {}

    # Attach is_forecast to each disease pressure record
    enriched = []
    for dp in disease_pressure_entries:
        is_forecast = weather_type_map.get(dp.date) == "forecast"
        dp_dict = dp.__dict__.copy()
        dp_dict["is_forecast"] = is_forecast
        enriched.append(dp_dict)
    return enriched

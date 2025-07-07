from sqlalchemy.future import select
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import date
from app.schemas.growth_potential import (
    GrowthPotentialWithForecast,
)
from app.models.growth_potential import GrowthPotential
from app.core.database import get_db
from app.models.daily_weather import DailyWeather

router = APIRouter(tags=["growth_potential"])


@router.get("/growth_potential/", response_model=List[GrowthPotentialWithForecast])
async def get_growth_potential(
    location_id: int = Query(..., description="Location ID"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(GrowthPotential).where(GrowthPotential.location_id == location_id)
    if start_date:
        stmt = stmt.where(GrowthPotential.date >= start_date)
    if end_date:
        stmt = stmt.where(GrowthPotential.date <= end_date)
    stmt = stmt.order_by(GrowthPotential.date.asc())
    result = await db.execute(stmt)
    growth_entries = result.scalars().all()
    # Batch fetch weather types for all dates
    dates = [gp.date for gp in growth_entries]
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
    enriched = []
    for gp in growth_entries:
        is_forecast = weather_type_map.get(gp.date) == "forecast"
        gp_dict = gp.__dict__.copy()
        gp_dict["is_forecast"] = is_forecast
        enriched.append(gp_dict)
    return enriched

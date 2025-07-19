from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import date

from app.core.database import get_db, SessionLocal
from app.models.weed_pressure import WeedSpecies, WeedPressure
from app.schemas.weed_pressure import (
    WeedSpecies as WeedSpeciesSchema,
    WeedPressure as WeedPressureSchema,
    WeedPressureChartResponse,
    WeedPressureChartRequest,
    WeedPressureChartFlatResponse,
)
from app.utils.weed_pressure import (
    calculate_weed_pressure_for_location,
    store_weed_pressure_data,
)
from app.tasks.weed_pressure import calculate_weed_pressure_for_location_task

try:
    from asyncio import run_in_threadpool
except ImportError:
    from concurrent.futures import ThreadPoolExecutor
    import asyncio

    def run_in_threadpool(func, *args, **kwargs):
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as executor:
            return loop.run_in_executor(executor, lambda: func(*args, **kwargs))


router = APIRouter(prefix="/weed-pressure", tags=["weed_pressure"])


@router.get("/species", response_model=List[WeedSpeciesSchema])
async def get_weed_species(
    db: AsyncSession = Depends(get_db),
    active_only: bool = Query(True, description="Return only active species"),
):
    """Get all weed species."""
    query = select(WeedSpecies)
    if active_only:
        query = query.where(WeedSpecies.is_active)

    result = await db.execute(query)
    species = result.scalars().all()
    return species


@router.get("/species/{species_id}", response_model=WeedSpeciesSchema)
async def get_weed_species_by_id(species_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific weed species by ID."""
    result = await db.execute(select(WeedSpecies).where(WeedSpecies.id == species_id))
    species = result.scalars().first()
    if not species:
        raise HTTPException(status_code=404, detail="Weed species not found")
    return species


@router.get("/location/{location_id}/current", response_model=List[WeedPressureSchema])
async def get_current_weed_pressure(
    location_id: int,
    db: AsyncSession = Depends(get_db),
    target_date: Optional[date] = Query(
        None, description="Target date (defaults to today)"
    ),
):
    """Get current weed pressure for a location."""
    if target_date is None:
        target_date = date.today()

    # Query for existing pressure entries
    query = (
        select(WeedPressure)
        .options(selectinload(WeedPressure.weed_species))
        .where(
            WeedPressure.location_id == location_id, WeedPressure.date == target_date
        )
    )
    result = await db.execute(query)
    pressure_entries = result.scalars().all()

    if not pressure_entries:
        # Calculate weed pressure if not available
        try:

            def sync_calc():
                with SessionLocal() as sync_session:
                    result = calculate_weed_pressure_for_location(
                        sync_session, location_id, target_date
                    )
                    if result:
                        store_weed_pressure_data(sync_session, result)
                        return True
                    return False

            success = await run_in_threadpool(sync_calc)

            if success:
                # Query again after storing
                result = await db.execute(query)
                pressure_entries = result.scalars().all()
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to calculate weed pressure: {str(e)}"
            )

    return pressure_entries


@router.post("/location/{location_id}/chart", response_model=WeedPressureChartResponse)
async def get_weed_pressure_chart(
    location_id: int,
    request: WeedPressureChartRequest,
    db: AsyncSession = Depends(get_db),
):
    """Get weed pressure chart data for a location and date range."""

    # Validate date range
    if request.start_date > request.end_date:
        raise HTTPException(
            status_code=400, detail="Start date must be before end date"
        )

    if (request.end_date - request.start_date).days > 365:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 365 days")

    # Get all weed species (or filtered by species_ids)
    species_query = select(WeedSpecies).where(WeedSpecies)
    if request.species_ids:
        species_query = species_query.where(WeedSpecies.id.in_(request.species_ids))

    result = await db.execute(species_query)
    species_list = result.scalars().all()
    if not species_list:
        raise HTTPException(status_code=404, detail="No weed species found")

    # Get weed pressure data for the date range
    pressure_query = (
        select(WeedPressure)
        .options(selectinload(WeedPressure.weed_species))
        .where(
            WeedPressure.location_id == location_id,
            WeedPressure.date >= request.start_date,
            WeedPressure.date <= request.end_date,
        )
    )

    if request.species_ids:
        pressure_query = pressure_query.where(WeedSpecies.id.in_(request.species_ids))

    result = await db.execute(pressure_query)
    pressure_entries = result.scalars().all()

    # Group data by species
    species_data = []
    for species in species_list:
        species_pressures = [
            p for p in pressure_entries if p.weed_species_id == species.id
        ]

        data_points = []
        for pressure in species_pressures:
            data_points.append(
                {
                    "date": pressure.date,
                    "pressure_score": pressure.weed_pressure_score,
                    "gdd_accumulated": pressure.gdd_accumulated,
                    "is_forecast": pressure.is_forecast,
                }
            )

        # Sort by date
        data_points.sort(key=lambda x: x["date"])

        species_data.append(
            {
                "species_id": species.id,
                "species_name": species.name,
                "common_name": species.common_name,
                "data_points": data_points,
            }
        )

    # Calculate current status
    current_date = date.today()
    current_pressures = [p for p in pressure_entries if p.date == current_date]

    if current_pressures:
        highest_pressure_entry = max(
            current_pressures, key=lambda x: x.weed_pressure_score
        )
        highest_pressure = highest_pressure_entry.weed_pressure_score
        status = get_weed_pressure_status(highest_pressure)
        recommendations = get_weed_pressure_recommendations(highest_pressure)
    else:
        highest_pressure = 0.0
        status = "No data"
        recommendations = ["Calculate current weed pressure"]

    return {
        "location_id": location_id,
        "date_range": {"start_date": request.start_date, "end_date": request.end_date},
        "species_data": species_data,
        "current_status": {
            "highest_pressure": highest_pressure,
            "status": status,
            "recommendations": recommendations,
        },
    }


@router.get(
    "/location/{location_id}/chart-flat",
    response_model=List[WeedPressureChartFlatResponse],
)
async def get_weed_pressure_chart_flat(
    location_id: int,
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    species_ids: Optional[str] = Query(None, description="Comma-separated species IDs"),
    include_forecast: bool = Query(True, description="Include forecast data"),
    db: AsyncSession = Depends(get_db),
):
    """Get flat weed pressure chart data for a location and date range (similar to growth potential)."""

    # Validate date range if both dates are provided
    if start_date and end_date:
        if start_date > end_date:
            raise HTTPException(
                status_code=400, detail="Start date must be before end date"
            )

        if (end_date - start_date).days > 365:
            raise HTTPException(
                status_code=400, detail="Date range cannot exceed 365 days"
            )

    # Parse species_ids from comma-separated string
    species_id_list = None
    if species_ids:
        try:
            species_id_list = [int(id.strip()) for id in species_ids.split(",")]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid species_ids format")

    # Get all weed species (or filtered by species_ids)
    species_query = select(WeedSpecies).where(WeedSpecies.is_active)
    if species_id_list:
        species_query = species_query.where(WeedSpecies.id.in_(species_id_list))

    result = await db.execute(species_query)
    species_list = result.scalars().all()
    if not species_list:
        raise HTTPException(status_code=404, detail="No weed species found")

    # Get weed pressure data for the date range
    pressure_query = (
        select(WeedPressure)
        .options(selectinload(WeedPressure.weed_species))
        .where(WeedPressure.location_id == location_id)
    )

    # Apply date filters only if provided
    if start_date:
        pressure_query = pressure_query.where(WeedPressure.date >= start_date)
    if end_date:
        pressure_query = pressure_query.where(WeedPressure.date <= end_date)

    if species_id_list:
        pressure_query = pressure_query.where(
            WeedPressure.weed_species_id.in_(species_id_list)
        )

    result = await db.execute(pressure_query)
    pressure_entries = result.scalars().all()

    # Convert to flat structure
    flat_data = []
    for pressure in pressure_entries:
        flat_data.append(
            {
                "date": pressure.date,
                "species_id": pressure.weed_species_id,
                "species_name": pressure.weed_species.name,
                "common_name": pressure.weed_species.common_name,
                "pressure_score": pressure.weed_pressure_score,
                "gdd_accumulated": pressure.gdd_accumulated,
                "is_forecast": pressure.is_forecast,
            }
        )

    # Sort by date, then by species name for consistency
    flat_data.sort(key=lambda x: (x["date"], x["common_name"]))

    return flat_data


@router.post("/location/{location_id}/calculate")
async def calculate_weed_pressure(
    location_id: int,
    target_date: Optional[date] = Query(
        None, description="Target date (defaults to today)"
    ),
    db: AsyncSession = Depends(get_db),
):
    """Trigger weed pressure calculation for a location."""
    if target_date is None:
        target_date = date.today()

    # Submit Celery task
    task = calculate_weed_pressure_for_location_task.delay(
        location_id, target_date.isoformat()
    )

    return {
        "message": "Weed pressure calculation started",
        "task_id": task.id,
        "location_id": location_id,
        "target_date": target_date,
    }


def get_weed_pressure_status(score: float) -> str:
    """Get status based on weed pressure score."""
    if score < 2.0:
        return "Low"
    elif score < 5.0:
        return "Moderate"
    elif score < 7.5:
        return "High"
    else:
        return "Very High"


def get_weed_pressure_recommendations(score: float) -> List[str]:
    """Get recommendations based on weed pressure score."""
    recommendations = []

    if score < 2.0:
        recommendations.extend(
            [
                "Continue regular maintenance practices",
                "Monitor for early signs of weed emergence",
            ]
        )
    elif score < 5.0:
        recommendations.extend(
            [
                "Consider pre-emergent herbicide application",
                "Increase monitoring frequency",
                "Maintain proper turf density",
            ]
        )
    elif score < 7.5:
        recommendations.extend(
            [
                "Apply pre-emergent herbicide if not already done",
                "Consider post-emergent treatment for existing weeds",
                "Improve cultural practices to reduce weed pressure",
            ]
        )
    else:
        recommendations.extend(
            [
                "Immediate action required - apply appropriate herbicides",
                "Consider multiple treatment approach",
                "Review and improve cultural practices",
                "Monitor treatment effectiveness",
            ]
        )

    return recommendations

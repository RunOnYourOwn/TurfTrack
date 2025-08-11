from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.lawn import Lawn
from app.models.water_management import IrrigationEntry, WeeklyWaterSummary
from app.schemas.water_management import (
    IrrigationEntryCreate,
    IrrigationEntryUpdate,
    IrrigationEntryRead,
    WaterManagementSummary,
)
from typing import List, Optional
from datetime import date, timedelta

router = APIRouter(prefix="/water-management", tags=["water_management"])


@router.get("/test")
async def test_endpoint():
    """Test endpoint to verify routing is working."""
    return {"message": "Water management router is working"}


@router.get("/lawn/{lawn_id}/irrigation", response_model=List[IrrigationEntryRead])
async def get_irrigation_entries(
    lawn_id: int,
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    """Get irrigation entries for a specific lawn."""
    # Verify lawn exists
    lawn = await db.get(Lawn, lawn_id)
    if not lawn:
        raise HTTPException(status_code=404, detail="Lawn not found")

    # Build query
    query = select(IrrigationEntry).where(IrrigationEntry.lawn_id == lawn_id)

    if start_date:
        query = query.where(IrrigationEntry.date >= start_date)
    if end_date:
        query = query.where(IrrigationEntry.date <= end_date)

    query = query.order_by(IrrigationEntry.date.desc())

    result = await db.execute(query)
    entries = result.scalars().all()
    return entries


@router.post(
    "/lawn/{lawn_id}/irrigation",
    response_model=IrrigationEntryRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_irrigation_entry(
    lawn_id: int,
    entry: IrrigationEntryCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new irrigation entry for a lawn."""
    # Verify lawn exists
    lawn = await db.get(Lawn, lawn_id)
    if not lawn:
        raise HTTPException(status_code=404, detail="Lawn not found")

    # Create irrigation entry
    db_entry = IrrigationEntry(
        lawn_id=lawn_id,
        date=entry.date,
        amount=entry.amount,
        duration=entry.duration,
        source=entry.source,
        notes=entry.notes,
    )

    db.add(db_entry)
    await db.commit()
    await db.refresh(db_entry)

    # Trigger weekly water summary recalculation for this lawn
    from app.tasks.water_management import (
        recalculate_weekly_water_summaries_for_lawn_task,
    )

    recalculate_weekly_water_summaries_for_lawn_task.delay(lawn_id)

    return db_entry


@router.put("/lawn/{lawn_id}/irrigation/{entry_id}", response_model=IrrigationEntryRead)
async def update_irrigation_entry(
    lawn_id: int,
    entry_id: int,
    entry: IrrigationEntryUpdate,
    db: AsyncSession = Depends(get_db),
):
    print(f"Received update data: {entry.dict()}")  # Debug log
    print(f"Lawn ID: {lawn_id}, Entry ID: {entry_id}")  # Debug log
    """Update an irrigation entry for a lawn."""
    # Verify lawn exists
    lawn = await db.get(Lawn, lawn_id)
    if not lawn:
        raise HTTPException(status_code=404, detail="Lawn not found")

    # Get the irrigation entry
    db_entry = await db.get(IrrigationEntry, entry_id)
    if not db_entry:
        raise HTTPException(status_code=404, detail="Irrigation entry not found")

    if db_entry.lawn_id != lawn_id:
        raise HTTPException(status_code=404, detail="Irrigation entry not found")

    # Update fields
    update_data = entry.dict(exclude_unset=True)
    print(f"Update data: {update_data}")  # Debug log
    for field, value in update_data.items():
        setattr(db_entry, field, value)

    await db.commit()
    await db.refresh(db_entry)

    # Trigger weekly water summary recalculation for this lawn
    from app.tasks.water_management import (
        recalculate_weekly_water_summaries_for_lawn_task,
    )

    recalculate_weekly_water_summaries_for_lawn_task.delay(lawn_id)

    return db_entry


@router.delete("/lawn/{lawn_id}/irrigation/{entry_id}")
async def delete_irrigation_entry(
    lawn_id: int,
    entry_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete an irrigation entry for a lawn."""
    # Verify lawn exists
    lawn = await db.get(Lawn, lawn_id)
    if not lawn:
        raise HTTPException(status_code=404, detail="Lawn not found")

    # Get the irrigation entry
    db_entry = await db.get(IrrigationEntry, entry_id)
    if not db_entry:
        raise HTTPException(status_code=404, detail="Irrigation entry not found")

    if db_entry.lawn_id != lawn_id:
        raise HTTPException(status_code=404, detail="Irrigation entry not found")

    await db.delete(db_entry)
    await db.commit()

    # Trigger weekly water summary recalculation for this lawn
    from app.tasks.water_management import (
        recalculate_weekly_water_summaries_for_lawn_task,
    )

    recalculate_weekly_water_summaries_for_lawn_task.delay(lawn_id)

    return {"message": "Irrigation entry deleted successfully"}


@router.get("/lawn/{lawn_id}/summary", response_model=WaterManagementSummary)
async def get_water_management_summary(
    lawn_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get water management summary for a lawn including weather data and irrigation."""
    # Verify lawn exists
    lawn = await db.get(Lawn, lawn_id)
    if not lawn:
        raise HTTPException(status_code=404, detail="Lawn not found")

    # Get weekly water summaries for a reasonable range (8 weeks ago to 4 weeks in future)
    today = date.today()
    start_date = today - timedelta(weeks=8)
    end_date = today + timedelta(weeks=4)

    weekly_summaries_query = (
        select(WeeklyWaterSummary)
        .where(
            WeeklyWaterSummary.lawn_id == lawn_id,
            WeeklyWaterSummary.week_start >= start_date,
            WeeklyWaterSummary.week_start <= end_date,
        )
        .order_by(WeeklyWaterSummary.week_start.asc())
    )

    weekly_result = await db.execute(weekly_summaries_query)
    weekly_summaries = weekly_result.scalars().all()

    # Get irrigation data for the last 30 days (for total monthly water calculation)
    irrigation_query = select(IrrigationEntry).where(
        IrrigationEntry.lawn_id == lawn_id,
        IrrigationEntry.date >= today - timedelta(days=30),
        IrrigationEntry.date <= today,
    )

    irrigation_result = await db.execute(irrigation_query)
    irrigation_data = irrigation_result.scalars().all()

    # Use stored weekly summaries
    weekly_data = []
    current_week = None

    for summary in weekly_summaries:
        weekly_data.append(summary)

        # Check if this is the current week
        if summary.week_start <= today <= summary.week_end:
            current_week = summary

    # Calculate total monthly water
    total_monthly_water = sum(entry.amount for entry in irrigation_data)

    return WaterManagementSummary(
        lawn_id=lawn_id,
        current_week=current_week,
        weekly_data=sorted(weekly_data, key=lambda x: x.week_start),
        total_monthly_water=total_monthly_water,
    )

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.mower import (
    Mower,
    MowingLog,
    MaintenanceSchedule,
    MaintenanceLog,
    MaintenancePart,
    MaintenanceLogPart,
)
from app.schemas.mower import (
    MowerCreate,
    MowerRead,
    MowerUpdate,
    MowingLogCreate,
    MowingLogRead,
    MaintenanceScheduleCreate,
    MaintenanceScheduleRead,
    MaintenanceLogCreate,
    MaintenanceLogRead,
    MaintenanceDueItem,
)
from typing import List
from datetime import datetime, timedelta
from app.core.logging_config import log_business_event

router = APIRouter(prefix="/mowers", tags=["mowers"])


from app.services.mower_service import MowerService


@router.get("/", response_model=List[MowerRead])
async def list_mowers(db: AsyncSession = Depends(get_db)):
    """List all mowers with their calculated total hours and maintenance due information."""
    mower_service = MowerService(db)
    return await mower_service.get_all_mowers_with_calculations()


@router.post("/", response_model=MowerRead, status_code=status.HTTP_201_CREATED)
async def create_mower(
    mower: MowerCreate, db: AsyncSession = Depends(get_db), request: Request = None
):
    """Create a new mower."""
    request_id = getattr(request.state, "request_id", None) if request else None

    db_mower = Mower(
        name=mower.name,
        brand=mower.brand,
        model=mower.model,
        year=mower.year,
        mower_type=mower.mower_type,
        engine_hours=mower.engine_hours,
        default_mowing_time_minutes=mower.default_mowing_time_minutes,
        notes=mower.notes,
        location_id=mower.location_id,
        is_active=mower.is_active,
    )
    db.add(db_mower)
    await db.commit()
    await db.refresh(db_mower)

    # Log business event
    log_business_event(
        "mower_created",
        f"Mower '{mower.name}' created",
        mower_id=db_mower.id,
        mower_name=mower.name,
        location_id=mower.location_id,
        request_id=request_id,
    )

    # Get mower with calculations using service
    mower_service = MowerService(db)
    return await mower_service.get_mower_with_calculations(db_mower.id)


@router.get("/{mower_id}", response_model=MowerRead)
async def get_mower(mower_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific mower by ID."""
    mower_service = MowerService(db)
    mower_data = await mower_service.get_mower_with_calculations(mower_id)

    if not mower_data:
        raise HTTPException(status_code=404, detail="Mower not found")

    return mower_data


@router.put("/{mower_id}", response_model=MowerRead)
async def update_mower(
    mower_id: int,
    mower: MowerUpdate,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """Update a mower."""
    request_id = getattr(request.state, "request_id", None) if request else None

    result = await db.execute(select(Mower).where(Mower.id == mower_id))
    db_mower = result.scalars().first()

    if not db_mower:
        raise HTTPException(status_code=404, detail="Mower not found")

    # Update only provided fields
    update_data = mower.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_mower, field, value)

    await db.commit()
    await db.refresh(db_mower)

    # Log business event
    log_business_event(
        "mower_updated",
        f"Mower '{db_mower.name}' updated",
        mower_id=mower_id,
        mower_name=db_mower.name,
        request_id=request_id,
    )

    # Get mower with calculations using service
    mower_service = MowerService(db)
    return await mower_service.get_mower_with_calculations(mower_id)


@router.delete("/{mower_id}")
async def delete_mower(
    mower_id: int, db: AsyncSession = Depends(get_db), request: Request = None
):
    """Delete a mower."""
    request_id = getattr(request.state, "request_id", None) if request else None

    result = await db.execute(select(Mower).where(Mower.id == mower_id))
    mower = result.scalars().first()

    if not mower:
        raise HTTPException(status_code=404, detail="Mower not found")

    mower_name = mower.name
    await db.delete(mower)
    await db.commit()

    # Log business event
    log_business_event(
        "mower_deleted",
        f"Mower '{mower_name}' deleted",
        mower_id=mower_id,
        mower_name=mower_name,
        request_id=request_id,
    )

    return {"message": "Mower deleted successfully"}


# Mowing Log endpoints
@router.get("/{mower_id}/mowing-logs", response_model=List[MowingLogRead])
async def list_mowing_logs(mower_id: int, db: AsyncSession = Depends(get_db)):
    """List all mowing logs for a specific mower."""
    result = await db.execute(
        select(MowingLog)
        .where(MowingLog.mower_id == mower_id)
        .order_by(MowingLog.mowing_date.desc())
    )
    logs = result.scalars().all()
    return logs


@router.post(
    "/{mower_id}/mowing-logs",
    response_model=MowingLogRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_mowing_log(
    mower_id: int,
    log: MowingLogCreate,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """Create a new mowing log for a mower."""
    request_id = getattr(request.state, "request_id", None) if request else None

    # Verify mower exists
    mower_result = await db.execute(select(Mower).where(Mower.id == mower_id))
    if not mower_result.scalars().first():
        raise HTTPException(status_code=404, detail="Mower not found")

    db_log = MowingLog(
        mower_id=mower_id,
        lawn_id=log.lawn_id,
        mowing_date=log.mowing_date,
        duration_minutes=log.duration_minutes,
        notes=log.notes,
    )
    db.add(db_log)
    await db.commit()
    await db.refresh(db_log)

    # Log business event
    log_business_event(
        "mowing_log_created",
        f"Mowing log created for mower {mower_id}",
        mower_id=mower_id,
        log_id=db_log.id,
        duration_minutes=log.duration_minutes,
        request_id=request_id,
    )

    return db_log


# Maintenance Schedule endpoints
@router.get(
    "/{mower_id}/maintenance-schedules", response_model=List[MaintenanceScheduleRead]
)
async def list_maintenance_schedules(mower_id: int, db: AsyncSession = Depends(get_db)):
    """List all maintenance schedules for a specific mower."""
    result = await db.execute(
        select(MaintenanceSchedule)
        .options(selectinload(MaintenanceSchedule.parts))
        .where(MaintenanceSchedule.mower_id == mower_id)
        .order_by(MaintenanceSchedule.maintenance_type)
    )
    schedules = result.scalars().all()

    # Calculate next maintenance due for each schedule
    schedules_with_calculations = []
    for schedule in schedules:
        # Get current total hours for the mower
        total_hours_result = await db.execute(
            select(MowingLog.duration_minutes).where(MowingLog.mower_id == mower_id)
        )
        mowing_minutes = total_hours_result.scalars().all()
        current_hours = sum(minutes for minutes in mowing_minutes) // 60

        # Calculate next maintenance
        next_maintenance_hours = (
            schedule.last_maintenance_hours + schedule.interval_hours
        )
        is_due = current_hours >= next_maintenance_hours

        # Create schedule dict with calculated fields
        schedule_dict = {
            **schedule.__dict__,
            "next_maintenance_hours": next_maintenance_hours,
            "next_maintenance_date": None,  # TODO: Calculate based on interval_months if needed
            "is_due": is_due,
        }
        schedules_with_calculations.append(schedule_dict)

    return schedules_with_calculations


@router.post(
    "/{mower_id}/maintenance-schedules",
    response_model=MaintenanceScheduleRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_maintenance_schedule(
    mower_id: int,
    schedule: MaintenanceScheduleCreate,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """Create a new maintenance schedule for a mower."""
    request_id = getattr(request.state, "request_id", None) if request else None

    # Verify mower exists
    mower_result = await db.execute(select(Mower).where(Mower.id == mower_id))
    if not mower_result.scalars().first():
        raise HTTPException(status_code=404, detail="Mower not found")

    db_schedule = MaintenanceSchedule(
        mower_id=mower_id,
        maintenance_type=schedule.maintenance_type,
        custom_name=schedule.custom_name,
        interval_hours=schedule.interval_hours,
        interval_months=schedule.interval_months,
        notes=schedule.notes,
    )
    db.add(db_schedule)
    await db.commit()
    await db.refresh(db_schedule)

    # Add parts if provided
    if schedule.parts:
        for part_data in schedule.parts:
            db_part = MaintenancePart(
                maintenance_schedule_id=db_schedule.id,
                part_name=part_data.part_name,
                part_number=part_data.part_number,
                supplier=part_data.supplier,
                part_url=part_data.part_url,
                estimated_cost=part_data.estimated_cost,
                notes=part_data.notes,
            )
            db.add(db_part)
        await db.commit()
        await db.refresh(db_schedule)

    # Log business event
    log_business_event(
        "maintenance_schedule_created",
        f"Maintenance schedule created for mower {mower_id}",
        mower_id=mower_id,
        schedule_id=db_schedule.id,
        maintenance_type=schedule.maintenance_type.value,
        request_id=request_id,
    )

    # Reload the schedule with parts relationship and calculate computed fields
    result = await db.execute(
        select(MaintenanceSchedule)
        .options(selectinload(MaintenanceSchedule.parts))
        .where(MaintenanceSchedule.id == db_schedule.id)
    )
    db_schedule = result.scalars().first()

    # Calculate computed fields
    mower_result = await db.execute(select(Mower).where(Mower.id == mower_id))
    mower = mower_result.scalars().first()

    # Calculate total hours for the mower
    total_hours_result = await db.execute(
        select(MowingLog.duration_minutes).where(MowingLog.mower_id == mower_id)
    )
    mowing_minutes = total_hours_result.scalars().all()
    total_hours = sum(minutes for minutes in mowing_minutes) // 60

    # Calculate next maintenance hours and date
    next_maintenance_hours = (
        db_schedule.last_maintenance_hours + db_schedule.interval_hours
    )

    # Calculate next maintenance date (approximate based on hours)
    next_maintenance_date = None
    if mower.engine_hours and total_hours > 0:
        # Estimate date based on hours difference and current usage rate
        hours_until_next = next_maintenance_hours - total_hours
        if hours_until_next > 0:
            # Rough estimate: assume 1 hour per week of mowing
            weeks_until_next = hours_until_next
            next_maintenance_date = datetime.now().date() + timedelta(
                weeks=weeks_until_next
            )

    # Calculate if maintenance is due
    is_due = total_hours >= next_maintenance_hours

    # Create response with computed fields
    schedule_dict = {
        **db_schedule.__dict__,
        "next_maintenance_hours": next_maintenance_hours,
        "next_maintenance_date": next_maintenance_date,
        "is_due": is_due,
    }

    return schedule_dict


# Maintenance Log endpoints
@router.get("/{mower_id}/maintenance-logs", response_model=List[MaintenanceLogRead])
async def list_maintenance_logs(mower_id: int, db: AsyncSession = Depends(get_db)):
    """List all maintenance logs for a specific mower."""
    result = await db.execute(
        select(MaintenanceLog)
        .options(selectinload(MaintenanceLog.parts_used))
        .where(MaintenanceLog.mower_id == mower_id)
        .order_by(MaintenanceLog.maintenance_date.desc())
    )
    logs = result.scalars().all()
    return logs


@router.post(
    "/{mower_id}/maintenance-logs",
    response_model=MaintenanceLogRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_maintenance_log(
    mower_id: int,
    log: MaintenanceLogCreate,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """Create a new maintenance log for a mower."""
    request_id = getattr(request.state, "request_id", None) if request else None

    # Verify mower exists
    mower_result = await db.execute(select(Mower).where(Mower.id == mower_id))
    if not mower_result.scalars().first():
        raise HTTPException(status_code=404, detail="Mower not found")

    db_log = MaintenanceLog(
        mower_id=mower_id,
        maintenance_schedule_id=log.maintenance_schedule_id,
        maintenance_type=log.maintenance_type,
        custom_name=log.custom_name,
        maintenance_date=log.maintenance_date,
        hours_at_maintenance=log.hours_at_maintenance,
        total_cost=log.total_cost,
        labor_cost=log.labor_cost,
        performed_by=log.performed_by,
        notes=log.notes,
    )
    db.add(db_log)
    await db.commit()
    await db.refresh(db_log)

    # Add parts used if provided
    if log.parts_used:
        for part_data in log.parts_used:
            db_part = MaintenanceLogPart(
                maintenance_log_id=db_log.id,
                part_name=part_data.part_name,
                part_number=part_data.part_number,
                quantity=part_data.quantity,
                unit_cost=part_data.unit_cost,
                total_cost=part_data.total_cost,
                supplier=part_data.supplier,
                notes=part_data.notes,
            )
            db.add(db_part)
        await db.commit()
        await db.refresh(db_log)

    # Update maintenance schedule using service
    mower_service = MowerService(db)
    await mower_service.update_maintenance_schedule_after_log(
        mower_id, log.maintenance_type
    )

    # Log business event
    log_business_event(
        "maintenance_log_created",
        f"Maintenance log created for mower {mower_id}",
        mower_id=mower_id,
        log_id=db_log.id,
        maintenance_type=log.maintenance_type.value,
        request_id=request_id,
    )

    # Eagerly load the parts_used relationship for proper serialization
    result = await db.execute(
        select(MaintenanceLog)
        .options(selectinload(MaintenanceLog.parts_used))
        .where(MaintenanceLog.id == db_log.id)
    )
    db_log = result.scalars().first()

    return db_log


# Maintenance Due endpoints
@router.get("/{mower_id}/maintenance-due", response_model=List[MaintenanceDueItem])
async def get_maintenance_due(mower_id: int, db: AsyncSession = Depends(get_db)):
    """Get maintenance items due for a specific mower."""
    # Get current total hours for the mower
    total_hours_result = await db.execute(
        select(MowingLog.duration_minutes).where(MowingLog.mower_id == mower_id)
    )
    mowing_minutes = total_hours_result.scalars().all()
    current_hours = sum(minutes for minutes in mowing_minutes) // 60

    # Get active maintenance schedules
    schedules_result = await db.execute(
        select(MaintenanceSchedule).where(
            MaintenanceSchedule.mower_id == mower_id,
            MaintenanceSchedule.is_active == True,
        )
    )
    schedules = schedules_result.scalars().all()

    # Get mower info
    mower_result = await db.execute(select(Mower).where(Mower.id == mower_id))
    mower = mower_result.scalars().first()
    if not mower:
        raise HTTPException(status_code=404, detail="Mower not found")

    maintenance_due_items = []
    for schedule in schedules:
        next_maintenance_hours = (
            schedule.last_maintenance_hours + schedule.interval_hours
        )
        hours_overdue = current_hours - next_maintenance_hours
        is_overdue = hours_overdue > 0

        if is_overdue:
            maintenance_due_items.append(
                MaintenanceDueItem(
                    mower_id=mower_id,
                    mower_name=mower.name,
                    maintenance_schedule_id=schedule.id,
                    maintenance_type=schedule.maintenance_type,
                    custom_name=schedule.custom_name,
                    last_maintenance_hours=schedule.last_maintenance_hours,
                    current_hours=current_hours,
                    hours_overdue=hours_overdue,
                    last_maintenance_date=schedule.last_maintenance_date,
                    next_maintenance_date=None,  # TODO: Calculate based on interval_months
                    is_overdue=is_overdue,
                )
            )

    return maintenance_due_items


@router.get("/maintenance-due/all", response_model=List[MaintenanceDueItem])
async def get_all_maintenance_due(db: AsyncSession = Depends(get_db)):
    """Get all maintenance items due across all mowers."""
    # Get all mowers with their current hours
    mowers_result = await db.execute(select(Mower))
    mowers = mowers_result.scalars().all()

    all_maintenance_due = []
    for mower in mowers:
        # Get current total hours for the mower
        total_hours_result = await db.execute(
            select(MowingLog.duration_minutes).where(MowingLog.mower_id == mower.id)
        )
        mowing_minutes = total_hours_result.scalars().all()
        current_hours = sum(minutes for minutes in mowing_minutes) // 60

        # Get active maintenance schedules for this mower
        schedules_result = await db.execute(
            select(MaintenanceSchedule).where(
                MaintenanceSchedule.mower_id == mower.id,
                MaintenanceSchedule.is_active == True,
            )
        )
        schedules = schedules_result.scalars().all()

        for schedule in schedules:
            next_maintenance_hours = (
                schedule.last_maintenance_hours + schedule.interval_hours
            )
            hours_overdue = current_hours - next_maintenance_hours
            is_overdue = hours_overdue > 0

            if is_overdue:
                all_maintenance_due.append(
                    MaintenanceDueItem(
                        mower_id=mower.id,
                        mower_name=mower.name,
                        maintenance_schedule_id=schedule.id,
                        maintenance_type=schedule.maintenance_type,
                        custom_name=schedule.custom_name,
                        last_maintenance_hours=schedule.last_maintenance_hours,
                        current_hours=current_hours,
                        hours_overdue=hours_overdue,
                        last_maintenance_date=schedule.last_maintenance_date,
                        next_maintenance_date=None,  # TODO: Calculate based on interval_months
                        is_overdue=is_overdue,
                    )
                )

    return all_maintenance_due


# Mowing Log Update and Delete endpoints
@router.put("/{mower_id}/mowing-logs/{log_id}", response_model=MowingLogRead)
async def update_mowing_log(
    mower_id: int,
    log_id: int,
    mowing_log: MowingLogCreate,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """Update a mowing log."""
    request_id = getattr(request.state, "request_id", None) if request else None

    # Verify mower exists
    mower_result = await db.execute(select(Mower).where(Mower.id == mower_id))
    mower = mower_result.scalars().first()
    if not mower:
        raise HTTPException(status_code=404, detail="Mower not found")

    # Get existing log
    log_result = await db.execute(
        select(MowingLog).where(MowingLog.id == log_id, MowingLog.mower_id == mower_id)
    )
    db_log = log_result.scalars().first()
    if not db_log:
        raise HTTPException(status_code=404, detail="Mowing log not found")

    # Update log
    update_data = mowing_log.model_dump()
    for field, value in update_data.items():
        setattr(db_log, field, value)

    await db.commit()
    await db.refresh(db_log)

    # Log business event
    log_business_event(
        "mowing_log_updated",
        f"Mowing log updated for mower '{mower.name}'",
        mower_id=mower_id,
        log_id=log_id,
        request_id=request_id,
    )

    return db_log


@router.delete("/{mower_id}/mowing-logs/{log_id}")
async def delete_mowing_log(
    mower_id: int,
    log_id: int,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """Delete a mowing log."""
    request_id = getattr(request.state, "request_id", None) if request else None

    # Verify mower exists
    mower_result = await db.execute(select(Mower).where(Mower.id == mower_id))
    mower = mower_result.scalars().first()
    if not mower:
        raise HTTPException(status_code=404, detail="Mower not found")

    # Get existing log
    log_result = await db.execute(
        select(MowingLog).where(MowingLog.id == log_id, MowingLog.mower_id == mower_id)
    )
    db_log = log_result.scalars().first()
    if not db_log:
        raise HTTPException(status_code=404, detail="Mowing log not found")

    await db.delete(db_log)
    await db.commit()

    # Log business event
    log_business_event(
        "mowing_log_deleted",
        f"Mowing log deleted for mower '{mower.name}'",
        mower_id=mower_id,
        log_id=log_id,
        request_id=request_id,
    )

    return {"message": "Mowing log deleted successfully"}


# Maintenance Schedule Update and Delete endpoints
@router.put(
    "/{mower_id}/maintenance-schedules/{schedule_id}",
    response_model=MaintenanceScheduleRead,
)
async def update_maintenance_schedule(
    mower_id: int,
    schedule_id: int,
    maintenance_schedule: MaintenanceScheduleCreate,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """Update a maintenance schedule."""
    request_id = getattr(request.state, "request_id", None) if request else None

    # Verify mower exists
    mower_result = await db.execute(select(Mower).where(Mower.id == mower_id))
    mower = mower_result.scalars().first()
    if not mower:
        raise HTTPException(status_code=404, detail="Mower not found")

    # Get existing schedule with relationships loaded
    schedule_result = await db.execute(
        select(MaintenanceSchedule)
        .options(selectinload(MaintenanceSchedule.parts))
        .where(
            MaintenanceSchedule.id == schedule_id,
            MaintenanceSchedule.mower_id == mower_id,
        )
    )
    db_schedule = schedule_result.scalars().first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Maintenance schedule not found")

    # Update schedule
    update_data = maintenance_schedule.model_dump()
    for field, value in update_data.items():
        setattr(db_schedule, field, value)

    await db.commit()
    await db.refresh(db_schedule)

    # Log business event
    log_business_event(
        "maintenance_schedule_updated",
        f"Maintenance schedule updated for mower '{mower.name}'",
        mower_id=mower_id,
        schedule_id=schedule_id,
        request_id=request_id,
    )

    # Return with calculated fields
    total_hours_result = await db.execute(
        select(MowingLog.duration_minutes).where(MowingLog.mower_id == mower_id)
    )
    mowing_minutes = total_hours_result.scalars().all()
    total_hours = sum(minutes for minutes in mowing_minutes) // 60

    next_maintenance_hours = (
        db_schedule.last_maintenance_hours + db_schedule.interval_hours
    )
    hours_until_next = next_maintenance_hours - total_hours
    next_maintenance_date = None
    if hours_until_next > 0:
        # Rough estimate: 1 hour per week of mowing
        weeks_until_next = hours_until_next
        next_maintenance_date = (
            datetime.now() + timedelta(weeks=weeks_until_next)
        ).date()

    is_due = total_hours >= next_maintenance_hours

    return {
        **db_schedule.__dict__,
        "parts": [],
        "next_maintenance_hours": next_maintenance_hours,
        "next_maintenance_date": next_maintenance_date,
        "is_due": is_due,
    }


@router.delete("/{mower_id}/maintenance-schedules/{schedule_id}")
async def delete_maintenance_schedule(
    mower_id: int,
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """Delete a maintenance schedule."""
    request_id = getattr(request.state, "request_id", None) if request else None

    # Verify mower exists
    mower_result = await db.execute(select(Mower).where(Mower.id == mower_id))
    mower = mower_result.scalars().first()
    if not mower:
        raise HTTPException(status_code=404, detail="Mower not found")

    # Get existing schedule
    schedule_result = await db.execute(
        select(MaintenanceSchedule).where(
            MaintenanceSchedule.id == schedule_id,
            MaintenanceSchedule.mower_id == mower_id,
        )
    )
    db_schedule = schedule_result.scalars().first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Maintenance schedule not found")

    await db.delete(db_schedule)
    await db.commit()

    # Log business event
    log_business_event(
        "maintenance_schedule_deleted",
        f"Maintenance schedule deleted for mower '{mower.name}'",
        mower_id=mower_id,
        schedule_id=schedule_id,
        request_id=request_id,
    )

    return {"message": "Maintenance schedule deleted successfully"}


# Maintenance Log Update and Delete endpoints
@router.put("/{mower_id}/maintenance-logs/{log_id}", response_model=MaintenanceLogRead)
async def update_maintenance_log(
    mower_id: int,
    log_id: int,
    maintenance_log: MaintenanceLogCreate,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """Update a maintenance log."""
    request_id = getattr(request.state, "request_id", None) if request else None

    # Verify mower exists
    mower_result = await db.execute(select(Mower).where(Mower.id == mower_id))
    mower = mower_result.scalars().first()
    if not mower:
        raise HTTPException(status_code=404, detail="Mower not found")

    # Get existing log with relationships loaded
    log_result = await db.execute(
        select(MaintenanceLog)
        .options(selectinload(MaintenanceLog.parts_used))
        .where(MaintenanceLog.id == log_id, MaintenanceLog.mower_id == mower_id)
    )
    db_log = log_result.scalars().first()
    if not db_log:
        raise HTTPException(status_code=404, detail="Maintenance log not found")

    # Store the old log info for schedule updates
    old_maintenance_type = db_log.maintenance_type
    old_hours = db_log.hours_at_maintenance

    # Update log
    update_data = maintenance_log.model_dump()
    for field, value in update_data.items():
        setattr(db_log, field, value)

    await db.commit()
    await db.refresh(db_log)

    # Update maintenance schedules if the maintenance type or hours changed
    new_maintenance_type = db_log.maintenance_type
    new_hours = db_log.hours_at_maintenance

    if old_maintenance_type != new_maintenance_type or old_hours != new_hours:
        # Update schedules for both old and new maintenance types using service
        mower_service = MowerService(db)
        maintenance_types_to_update = set([old_maintenance_type, new_maintenance_type])

        for maintenance_type in maintenance_types_to_update:
            if maintenance_type:
                await mower_service.update_maintenance_schedule_after_log(
                    mower_id, maintenance_type
                )

    # Log business event
    log_business_event(
        "maintenance_log_updated",
        f"Maintenance log updated for mower '{mower.name}'",
        mower_id=mower_id,
        log_id=log_id,
        request_id=request_id,
    )

    # Return with parts_used relationship loaded
    result = await db.execute(
        select(MaintenanceLog)
        .options(selectinload(MaintenanceLog.parts_used))
        .where(MaintenanceLog.id == log_id)
    )
    db_log = result.scalars().first()

    return db_log


@router.delete("/{mower_id}/maintenance-logs/{log_id}")
async def delete_maintenance_log(
    mower_id: int,
    log_id: int,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """Delete a maintenance log."""
    request_id = getattr(request.state, "request_id", None) if request else None

    # Verify mower exists
    mower_result = await db.execute(select(Mower).where(Mower.id == mower_id))
    mower = mower_result.scalars().first()
    if not mower:
        raise HTTPException(status_code=404, detail="Mower not found")

    # Get existing log
    log_result = await db.execute(
        select(MaintenanceLog).where(
            MaintenanceLog.id == log_id, MaintenanceLog.mower_id == mower_id
        )
    )
    db_log = log_result.scalars().first()
    if not db_log:
        raise HTTPException(status_code=404, detail="Maintenance log not found")

    # Store the log info before deletion for schedule updates
    deleted_log_hours = db_log.hours_at_maintenance
    deleted_log_maintenance_type = db_log.maintenance_type
    deleted_log_maintenance_date = db_log.maintenance_date

    await db.delete(db_log)
    await db.commit()

    # Update maintenance schedules using service
    mower_service = MowerService(db)
    await mower_service.update_maintenance_schedule_after_log(
        mower_id, deleted_log_maintenance_type
    )

    # Log business event
    log_business_event(
        "maintenance_log_deleted",
        f"Maintenance log deleted for mower '{mower.name}'",
        mower_id=mower_id,
        log_id=log_id,
        request_id=request_id,
    )

    return {"message": "Maintenance log deleted successfully"}

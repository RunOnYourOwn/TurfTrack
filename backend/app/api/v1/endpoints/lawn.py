from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.lawn import Lawn, GrassType, WeatherFetchFrequency
from app.schemas.lawn import LawnCreate, LawnRead, LawnUpdate
from typing import List
from datetime import date
from app.utils.location import get_or_create_location, cleanup_orphaned_location
from app.utils.weather import trigger_weather_fetch_if_needed
from app.core.logging_config import log_business_event

router = APIRouter(prefix="/lawns", tags=["lawns"])


@router.get("/", response_model=List[LawnRead])
async def list_lawns(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Lawn).options(selectinload(Lawn.location)))
    lawns = result.scalars().all()
    return lawns


@router.post("/", response_model=LawnRead, status_code=status.HTTP_201_CREATED)
async def create_lawn(
    lawn: LawnCreate, db: AsyncSession = Depends(get_db), request: Request = None
):
    request_id = getattr(request.state, "request_id", None) if request else None

    db_lawn = Lawn(
        name=lawn.name,
        area=lawn.area,
        grass_type=GrassType(lawn.grass_type),
        notes=lawn.notes,
        weather_fetch_frequency=WeatherFetchFrequency(lawn.weather_fetch_frequency),
        timezone=lawn.timezone,
        weather_enabled=lawn.weather_enabled,
        location_id=lawn.location_id,
    )
    db.add(db_lawn)
    await db.commit()
    await db.refresh(db_lawn)

    # Log business event
    log_business_event(
        "lawn_created",
        f"Lawn '{lawn.name}' created",
        lawn_id=db_lawn.id,
        lawn_name=lawn.name,
        location_id=lawn.location_id,
        request_id=request_id,
    )

    # Eagerly load the location relationship
    result = await db.execute(
        select(Lawn).options(selectinload(Lawn.location)).where(Lawn.id == db_lawn.id)
    )
    db_lawn = result.scalars().first()

    # Trigger weather fetch if needed, passing request_id if available
    weather_task = await trigger_weather_fetch_if_needed(
        db, db_lawn, request_id=request_id
    )

    # Trigger weed pressure calculation for this location
    from app.tasks.weed_pressure import calculate_weed_pressure_for_location_task

    # Calculate for today's date
    today = date.today().isoformat()

    # If weather task was triggered, chain weed pressure to run after it
    if weather_task:
        weather_task.then(
            calculate_weed_pressure_for_location_task.s(db_lawn.location_id, today)
        )
    else:
        # If no weather task was needed (data already exists), run weed pressure immediately
        calculate_weed_pressure_for_location_task.delay(db_lawn.location_id, today)

    # The location relationship needs to be loaded before returning
    await db.refresh(db_lawn, attribute_names=["location"])
    return db_lawn


@router.get("/{lawn_id}", response_model=LawnRead)
async def get_lawn(lawn_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Lawn).options(selectinload(Lawn.location)).where(Lawn.id == lawn_id)
    )
    lawn = result.scalars().first()
    if not lawn:
        raise HTTPException(status_code=404, detail="Lawn not found")
    return lawn


@router.put("/{lawn_id}", response_model=LawnRead)
async def update_lawn(
    lawn_id: int,
    lawn: LawnUpdate,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    request_id = getattr(request.state, "request_id", None) if request else None

    db_lawn = await db.get(Lawn, lawn_id)
    if not db_lawn:
        raise HTTPException(status_code=404, detail="Lawn not found")

    # Log business event before update
    log_business_event(
        "lawn_updated",
        f"Lawn '{db_lawn.name}' updated",
        lawn_id=lawn_id,
        lawn_name=db_lawn.name,
        location_id=db_lawn.location_id,
        request_id=request_id,
    )

    # Store the old location_id for cleanup check
    old_location_id = db_lawn.location_id

    update_data = lawn.dict(exclude_unset=True)

    # Handle location changes
    location_changed = False
    if (
        "latitude" in update_data
        and "longitude" in update_data
        and update_data["latitude"] is not None
        and update_data["longitude"] is not None
    ):
        location = await get_or_create_location(
            db, update_data["latitude"], update_data["longitude"]
        )
        if db_lawn.location_id != location.id:
            db_lawn.location_id = location.id
            location_changed = True
        update_data.pop("latitude")
        update_data.pop("longitude")
    elif "location_id" in update_data and update_data["location_id"] is not None:
        if db_lawn.location_id != update_data["location_id"]:
            db_lawn.location_id = update_data["location_id"]
            location_changed = True
        update_data.pop("location_id")

    # Update other fields
    for field, value in update_data.items():
        if field == "grass_type" and value is not None:
            setattr(db_lawn, field, GrassType(value))
        elif field == "weather_fetch_frequency" and value is not None:
            setattr(db_lawn, field, WeatherFetchFrequency(value))
        else:
            setattr(db_lawn, field, value)

    await db.commit()
    await db.refresh(db_lawn)

    # Eagerly load the location relationship
    result = await db.execute(
        select(Lawn).options(selectinload(Lawn.location)).where(Lawn.id == db_lawn.id)
    )
    db_lawn = result.scalars().first()

    # Trigger weather fetch if needed, passing request_id if available
    weather_task = await trigger_weather_fetch_if_needed(
        db, db_lawn, request_id=request_id
    )

    # Clean up old location if it was changed and is now orphaned
    if location_changed:
        await cleanup_orphaned_location(db, old_location_id)

    # The location relationship needs to be loaded before returning
    await db.refresh(db_lawn, attribute_names=["location"])
    return db_lawn


@router.delete("/{lawn_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lawn(
    lawn_id: int, db: AsyncSession = Depends(get_db), request: Request = None
):
    request_id = getattr(request.state, "request_id", None) if request else None

    db_lawn = await db.get(Lawn, lawn_id)
    if not db_lawn:
        raise HTTPException(status_code=404, detail="Lawn not found")

    # Log business event before deletion
    log_business_event(
        "lawn_deleted",
        f"Lawn '{db_lawn.name}' deleted",
        lawn_id=lawn_id,
        lawn_name=db_lawn.name,
        location_id=db_lawn.location_id,
        request_id=request_id,
    )

    # Store location_id for later use
    location_id = db_lawn.location_id

    # Delete the lawn (this will cascade to delete GDD models)
    await db.delete(db_lawn)
    await db.commit()

    # Clean up location if it's now orphaned
    await cleanup_orphaned_location(db, location_id)

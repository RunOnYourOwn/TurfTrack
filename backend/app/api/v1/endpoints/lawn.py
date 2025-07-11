from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.lawn import Lawn, GrassType, WeatherFetchFrequency
from app.schemas.lawn import LawnCreate, LawnRead, LawnUpdate
from typing import List
from app.utils.location import get_or_create_location, cleanup_orphaned_location
from app.utils.weather import trigger_weather_fetch_if_needed

router = APIRouter(prefix="/lawns", tags=["lawns"])


@router.get("/", response_model=List[LawnRead])
async def list_lawns(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Lawn).options(selectinload(Lawn.location)))
    lawns = result.scalars().all()
    return lawns


@router.post("/", response_model=LawnRead, status_code=status.HTTP_201_CREATED)
async def create_lawn(lawn: LawnCreate, db: AsyncSession = Depends(get_db)):
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

    # Eagerly load the location relationship
    result = await db.execute(
        select(Lawn).options(selectinload(Lawn.location)).where(Lawn.id == db_lawn.id)
    )
    db_lawn = result.scalars().first()

    # Trigger weather fetch if needed
    await trigger_weather_fetch_if_needed(db, db_lawn)

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
    lawn_id: int, lawn: LawnUpdate, db: AsyncSession = Depends(get_db)
):
    db_lawn = await db.get(Lawn, lawn_id)
    if not db_lawn:
        raise HTTPException(status_code=404, detail="Lawn not found")

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

    # Trigger weather fetch if needed
    await trigger_weather_fetch_if_needed(db, db_lawn)

    # Clean up old location if it was changed and is now orphaned
    if location_changed:
        await cleanup_orphaned_location(db, old_location_id)

    # The location relationship needs to be loaded before returning
    await db.refresh(db_lawn, attribute_names=["location"])
    return db_lawn


@router.delete("/{lawn_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lawn(lawn_id: int, db: AsyncSession = Depends(get_db)):
    # Get the lawn with its location
    result = await db.execute(
        select(Lawn).options(selectinload(Lawn.location)).where(Lawn.id == lawn_id)
    )
    db_lawn = result.scalars().first()
    if not db_lawn:
        raise HTTPException(status_code=404, detail="Lawn not found")

    # Store location_id for later use
    location_id = db_lawn.location_id

    # Delete the lawn (this will cascade to delete GDD models)
    await db.delete(db_lawn)
    await db.commit()

    # Clean up location if it's now orphaned
    await cleanup_orphaned_location(db, location_id)

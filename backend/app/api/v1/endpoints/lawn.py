from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import exists
from app.core.database import get_db
from app.models.lawn import Lawn, GrassType, WeatherFetchFrequency
from app.schemas.lawn import LawnCreate, LawnRead, LawnUpdate
from typing import List
from app.utils.location import get_or_create_location
from app.tasks.weather import fetch_and_store_weather
from app.models.daily_weather import DailyWeather
from app.models.location import Location
from app.models.task_status import TaskStatus
import logging
import uuid
import datetime

router = APIRouter(prefix="/lawns", tags=["lawns"])


@router.get("/", response_model=List[LawnRead])
async def list_lawns(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Lawn).options(selectinload(Lawn.location)))
    lawns = result.scalars().all()
    return [
        LawnRead(
            id=lawn.id,
            name=lawn.name,
            area=lawn.area,
            grass_type=lawn.grass_type,
            notes=lawn.notes,
            weather_fetch_frequency=lawn.weather_fetch_frequency,
            timezone=lawn.timezone,
            weather_enabled=lawn.weather_enabled,
            latitude=lawn.location.latitude if lawn.location else None,
            longitude=lawn.location.longitude if lawn.location else None,
            created_at=lawn.created_at,
            updated_at=lawn.updated_at,
        )
        for lawn in lawns
    ]


@router.post("/", response_model=LawnRead, status_code=status.HTTP_201_CREATED)
async def create_lawn(lawn: LawnCreate, db: AsyncSession = Depends(get_db)):
    location = await get_or_create_location(db, lawn.latitude, lawn.longitude)
    db_lawn = Lawn(
        name=lawn.name,
        area=lawn.area,
        grass_type=GrassType(lawn.grass_type),
        notes=lawn.notes,
        weather_fetch_frequency=WeatherFetchFrequency(lawn.weather_fetch_frequency),
        timezone=lawn.timezone,
        weather_enabled=lawn.weather_enabled,
        location_id=location.id,
    )
    db.add(db_lawn)
    await db.commit()
    await db.refresh(db_lawn)
    # Trigger weather fetch task if enabled and no weather data exists for this location
    weather_exists = await db.execute(
        select(exists().where(DailyWeather.location_id == location.id))
    )
    logger = logging.getLogger("turftrack.lawn")
    if db_lawn.weather_enabled and not weather_exists.scalar():
        logger.info(
            f"No weather data found for location_id={location.id}. Triggering fetch_and_store_weather."
        )
        fetch_and_store_weather.delay(
            location.id, location.latitude, location.longitude
        )
    else:
        logger.info(
            f"Weather data already exists for location_id={location.id}. No fetch needed."
        )
        # Create a TaskStatus record to indicate weather already exists
        from app.models.task_status import TaskStatus, TaskStatusEnum

        now = datetime.datetime.now(datetime.timezone.utc)
        task_status = TaskStatus(
            task_id=str(uuid.uuid4()),
            task_name="fetch_and_store_weather",
            related_location_id=location.id,
            status=TaskStatusEnum.success,
            created_at=now,
            started_at=now,
            finished_at=now,
            result="Weather data for this location already exists. No new fetch was needed.",
        )
        db.add(task_status)
        await db.commit()
    return LawnRead(
        id=db_lawn.id,
        name=db_lawn.name,
        area=db_lawn.area,
        grass_type=db_lawn.grass_type,
        notes=db_lawn.notes,
        weather_fetch_frequency=db_lawn.weather_fetch_frequency,
        timezone=db_lawn.timezone,
        weather_enabled=db_lawn.weather_enabled,
        latitude=location.latitude,
        longitude=location.longitude,
        created_at=db_lawn.created_at,
        updated_at=db_lawn.updated_at,
    )


@router.get("/{lawn_id}", response_model=LawnRead)
async def get_lawn(lawn_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Lawn).options(selectinload(Lawn.location)).where(Lawn.id == lawn_id)
    )
    lawn = result.scalars().first()
    if not lawn:
        raise HTTPException(status_code=404, detail="Lawn not found")
    location = lawn.location
    return LawnRead(
        id=lawn.id,
        name=lawn.name,
        area=lawn.area,
        grass_type=lawn.grass_type,
        notes=lawn.notes,
        weather_fetch_frequency=lawn.weather_fetch_frequency,
        timezone=lawn.timezone,
        weather_enabled=lawn.weather_enabled,
        latitude=location.latitude if location else None,
        longitude=location.longitude if location else None,
        created_at=lawn.created_at,
        updated_at=lawn.updated_at,
    )


@router.put("/{lawn_id}", response_model=LawnRead)
async def update_lawn(
    lawn_id: int, lawn: LawnUpdate, db: AsyncSession = Depends(get_db)
):
    db_lawn = await db.get(Lawn, lawn_id)
    if not db_lawn:
        raise HTTPException(status_code=404, detail="Lawn not found")
    update_data = lawn.dict(exclude_unset=True)
    if (
        "latitude" in update_data
        and "longitude" in update_data
        and update_data["latitude"] is not None
        and update_data["longitude"] is not None
    ):
        location = await get_or_create_location(
            db, update_data["latitude"], update_data["longitude"]
        )
        db_lawn.location_id = location.id
        update_data.pop("latitude")
        update_data.pop("longitude")
    for field, value in update_data.items():
        if field == "grass_type" and value is not None:
            setattr(db_lawn, field, GrassType(value))
        elif field == "weather_fetch_frequency" and value is not None:
            setattr(db_lawn, field, WeatherFetchFrequency(value))
        else:
            setattr(db_lawn, field, value)
    await db.commit()
    await db.refresh(db_lawn)
    location = db_lawn.location
    # Trigger weather fetch task if enabled and no weather data exists for this location
    weather_exists = await db.execute(
        select(exists().where(DailyWeather.location_id == location.id))
    )
    logger = logging.getLogger("turftrack.lawn")
    if db_lawn.weather_enabled and not weather_exists.scalar():
        logger.info(
            f"No weather data found for location_id={location.id}. Triggering fetch_and_store_weather."
        )
        fetch_and_store_weather.delay(
            location.id, location.latitude, location.longitude
        )
    else:
        logger.info(
            f"Weather data already exists for location_id={location.id}. No fetch needed."
        )
    return LawnRead(
        id=db_lawn.id,
        name=db_lawn.name,
        area=db_lawn.area,
        grass_type=db_lawn.grass_type,
        notes=db_lawn.notes,
        weather_fetch_frequency=db_lawn.weather_fetch_frequency,
        timezone=db_lawn.timezone,
        weather_enabled=db_lawn.weather_enabled,
        latitude=location.latitude if location else None,
        longitude=location.longitude if location else None,
        created_at=db_lawn.created_at,
        updated_at=db_lawn.updated_at,
    )


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

    # Delete the lawn
    await db.delete(db_lawn)
    await db.commit()

    # Check if this was the last lawn using this location
    result = await db.execute(select(Lawn).where(Lawn.location_id == location_id))
    remaining_lawns = result.scalars().all()

    if not remaining_lawns:
        # This was the last lawn, delete location and weather data
        # First delete all weather data for this location
        await db.execute(
            DailyWeather.__table__.delete().where(
                DailyWeather.location_id == location_id
            )
        )
        # Then delete all task_status records for this location
        await db.execute(
            TaskStatus.__table__.delete().where(
                TaskStatus.related_location_id == location_id
            )
        )
        # Then delete the location
        await db.execute(Location.__table__.delete().where(Location.id == location_id))
        await db.commit()

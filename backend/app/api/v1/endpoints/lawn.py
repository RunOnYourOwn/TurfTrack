from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.lawn import Lawn, GrassType, WeatherFetchFrequency
from app.schemas.lawn import LawnCreate, LawnRead, LawnUpdate
from typing import List
from app.utils.location import get_or_create_location
from app.utils.weather import trigger_weather_fetch_if_needed

router = APIRouter(prefix="/lawns", tags=["lawns"])


@router.get("/", response_model=List[LawnRead])
async def list_lawns(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Lawn).options(selectinload(Lawn.location)))
    lawns = result.scalars().all()
    return lawns


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

    # Trigger weather fetch if needed
    await trigger_weather_fetch_if_needed(db, db_lawn)

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

    # Check if this was the last lawn using this location
    result = await db.execute(select(Lawn).where(Lawn.location_id == location_id))
    remaining_lawns = result.scalars().all()

    if not remaining_lawns:
        # This was the last lawn, clean up location-related data
        from app.models.location import Location
        from app.models.daily_weather import DailyWeather
        from app.models.task_status import TaskStatus

        # Delete weather data for this location
        await db.execute(
            DailyWeather.__table__.delete().where(
                DailyWeather.location_id == location_id
            )
        )

        # Delete task status records for this location
        await db.execute(
            TaskStatus.__table__.delete().where(
                TaskStatus.related_location_id == location_id
            )
        )

        # Delete the location
        location = await db.get(Location, location_id)
        if location:
            await db.delete(location)

        await db.commit()

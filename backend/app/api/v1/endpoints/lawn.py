from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.lawn import Lawn, GrassType, WeatherFetchFrequency
from app.schemas.lawn import LawnCreate, LawnRead, LawnUpdate
from typing import List
from app.utils.location import get_or_create_location
from app.tasks.weather import fetch_and_store_weather

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
    # Trigger weather fetch task if enabled
    if db_lawn.weather_enabled:
        fetch_and_store_weather.delay(
            location.id, location.latitude, location.longitude
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
    db_lawn = await db.get(Lawn, lawn_id)
    if not db_lawn:
        raise HTTPException(status_code=404, detail="Lawn not found")
    await db.delete(db_lawn)
    await db.commit()

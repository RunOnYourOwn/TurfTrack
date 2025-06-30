from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.location import Location
from app.schemas.location import LocationCreate, LocationRead
from typing import List

router = APIRouter(prefix="/locations", tags=["locations"])


@router.post("/", response_model=LocationRead, status_code=status.HTTP_201_CREATED)
async def create_location(location: LocationCreate, db: AsyncSession = Depends(get_db)):
    # Check for unique name
    existing = await db.execute(select(Location).where(Location.name == location.name))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Location name must be unique")
    db_location = Location(
        name=location.name,
        latitude=location.latitude,
        longitude=location.longitude,
    )
    db.add(db_location)
    await db.commit()
    await db.refresh(db_location)
    return db_location


@router.get("/", response_model=List[LocationRead])
async def list_locations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Location))
    return result.scalars().all()

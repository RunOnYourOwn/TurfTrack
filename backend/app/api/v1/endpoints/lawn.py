from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.lawn import Lawn, GrassType
from app.schemas.lawn import LawnCreate, LawnRead, LawnUpdate
from typing import List

router = APIRouter(prefix="/lawns", tags=["lawns"])


@router.get("/", response_model=List[LawnRead])
async def list_lawns(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Lawn))
    return result.scalars().all()


@router.post("/", response_model=LawnRead, status_code=status.HTTP_201_CREATED)
async def create_lawn(lawn: LawnCreate, db: AsyncSession = Depends(get_db)):
    db_lawn = Lawn(
        name=lawn.name,
        area=lawn.area,
        grass_type=GrassType(lawn.grass_type),
        location=lawn.location,
        notes=lawn.notes,
    )
    db.add(db_lawn)
    await db.commit()
    await db.refresh(db_lawn)
    return db_lawn


@router.get("/{lawn_id}", response_model=LawnRead)
async def get_lawn(lawn_id: int, db: AsyncSession = Depends(get_db)):
    lawn = await db.get(Lawn, lawn_id)
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
    for field, value in lawn.dict(exclude_unset=True).items():
        if field == "grass_type" and value is not None:
            setattr(db_lawn, field, GrassType(value))
        else:
            setattr(db_lawn, field, value)
    await db.commit()
    await db.refresh(db_lawn)
    return db_lawn


@router.delete("/{lawn_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lawn(lawn_id: int, db: AsyncSession = Depends(get_db)):
    db_lawn = await db.get(Lawn, lawn_id)
    if not db_lawn:
        raise HTTPException(status_code=404, detail="Lawn not found")
    await db.delete(db_lawn)
    await db.commit()

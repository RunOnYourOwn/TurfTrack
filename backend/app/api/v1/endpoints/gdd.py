from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db, SessionLocal
from app.models import GDDModel, Lawn
from app.schemas.gdd import (
    GDDModelCreate,
    GDDModelUpdate,
    GDDModelRead,
    GDDModelWithValues,
    GDDResetRead,
    GDDValueRead,
)
from typing import List
from starlette.concurrency import run_in_threadpool
from app.utils.gdd import (
    calculate_and_store_gdd_values_sync_segmented,
    manual_gdd_reset_sync,
)
from datetime import date as datetime_date
from app.models.gdd import GDDReset, ResetType, GDDValue

router = APIRouter(prefix="/gdd_models", tags=["gdd"])


@router.post("/", response_model=GDDModelRead, status_code=status.HTTP_201_CREATED)
async def create_gdd_model(model: GDDModelCreate, db: AsyncSession = Depends(get_db)):
    # Check for unique name per lawn
    existing = await db.execute(
        select(GDDModel).where(
            GDDModel.lawn_id == model.lawn_id, GDDModel.name == model.name
        )
    )
    if existing.scalars().first():
        raise HTTPException(
            status_code=400, detail="GDD model name must be unique per lawn."
        )
    db_model = GDDModel(**model.dict())
    db.add(db_model)
    await db.commit()
    await db.refresh(db_model)
    # Always create initial reset for new GDD model
    initial_reset = GDDReset(
        gdd_model_id=db_model.id,
        reset_date=db_model.start_date,
        run_number=1,
        reset_type=ResetType.initial,
    )
    db.add(initial_reset)
    await db.commit()
    # Calculate and store GDD values (sync, run in threadpool)
    # Need to get location_id from the lawn
    lawn = await db.get(Lawn, db_model.lawn_id)
    if not lawn:
        raise HTTPException(status_code=400, detail="Lawn not found for GDD model.")

    def sync_calc():
        with SessionLocal() as sync_session:
            calculate_and_store_gdd_values_sync_segmented(
                sync_session, db_model.id, lawn.location_id
            )

    await run_in_threadpool(sync_calc)
    return db_model


@router.get("/lawn/{lawn_id}", response_model=List[GDDModelRead])
async def list_gdd_models(lawn_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GDDModel).where(GDDModel.lawn_id == lawn_id))
    return result.scalars().all()


@router.get("/{model_id}", response_model=GDDModelWithValues)
async def get_gdd_model_with_values(model_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(GDDModel)
        .options(selectinload(GDDModel.gdd_values))
        .where(GDDModel.id == model_id)
    )
    model = result.scalars().first()
    if not model:
        raise HTTPException(status_code=404, detail="GDD model not found")
    return model


@router.put("/{model_id}", response_model=GDDModelRead)
async def update_gdd_model(
    model_id: int, update: GDDModelUpdate, db: AsyncSession = Depends(get_db)
):
    db_model = await db.get(GDDModel, model_id)
    if not db_model:
        raise HTTPException(status_code=404, detail="GDD model not found")
    for field, value in update.dict(exclude_unset=True).items():
        setattr(db_model, field, value)
    await db.commit()
    await db.refresh(db_model)
    lawn = await db.get(Lawn, db_model.lawn_id)
    if not lawn:
        raise HTTPException(status_code=400, detail="Lawn not found for GDD model.")

    def sync_calc():
        with SessionLocal() as sync_session:
            calculate_and_store_gdd_values_sync_segmented(
                sync_session, db_model.id, lawn.location_id
            )

    await run_in_threadpool(sync_calc)
    return db_model


@router.delete("/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gdd_model(model_id: int, db: AsyncSession = Depends(get_db)):
    db_model = await db.get(GDDModel, model_id)
    if not db_model:
        raise HTTPException(status_code=404, detail="GDD model not found")
    await db.delete(db_model)
    await db.commit()


@router.post("/{model_id}/reset", status_code=status.HTTP_200_OK)
async def reset_gdd_model(
    model_id: int, reset_date: str, db: AsyncSession = Depends(get_db)
):
    try:
        reset_date_obj = datetime_date.fromisoformat(reset_date)
    except Exception:
        raise HTTPException(
            status_code=400, detail="Invalid reset_date format. Use YYYY-MM-DD."
        )
    db_model = await db.get(GDDModel, model_id)
    lawn = await db.get(Lawn, db_model.lawn_id)

    def sync_reset():
        with SessionLocal() as sync_session:
            manual_gdd_reset_sync(sync_session, model_id, reset_date_obj)
            calculate_and_store_gdd_values_sync_segmented(
                sync_session, db_model.id, lawn.location_id
            )

    await run_in_threadpool(sync_reset)
    return {"message": "GDD model reset and recalculated."}


@router.get("/{model_id}/resets", response_model=List[GDDResetRead])
async def list_gdd_resets(model_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(GDDReset)
        .where(GDDReset.gdd_model_id == model_id)
        .order_by(GDDReset.reset_date.asc())
    )
    return result.scalars().all()


@router.get("/{model_id}/runs/{run_number}/values", response_model=List[GDDValueRead])
async def get_gdd_values_for_run(
    model_id: int, run_number: int, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(GDDValue)
        .where(GDDValue.gdd_model_id == model_id, GDDValue.run == run_number)
        .order_by(GDDValue.date.asc())
    )
    values = result.scalars().all()
    return values

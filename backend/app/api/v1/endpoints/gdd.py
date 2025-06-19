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
    GDDModelWithHistory,
    GDDResetRead,
    GDDValueRead,
    GDDParameterUpdate,
    GDDParameterHistory,
)
from typing import List
from starlette.concurrency import run_in_threadpool
from app.utils.gdd import (
    calculate_and_store_gdd_values_sync_segmented,
    manual_gdd_reset_sync,
    store_parameter_history,
    recalculate_historical_gdd,
)
from datetime import date as datetime_date
from app.models.gdd import GDDReset, ResetType, GDDValue, GDDModelParameters

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

    # Store initial parameters in history
    def sync_store_params():
        with SessionLocal() as sync_session:
            store_parameter_history(
                sync_session,
                db_model.id,
                db_model.base_temp,
                db_model.threshold,
                db_model.reset_on_threshold,
                db_model.start_date,
            )

    await run_in_threadpool(sync_store_params)

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


@router.get("/", response_model=List[GDDModelRead])
async def list_all_gdd_models(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GDDModel))
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


@router.get("/{model_id}/history", response_model=List[GDDParameterHistory])
async def get_gdd_model_with_history(model_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(GDDModelParameters)
        .where(GDDModelParameters.gdd_model_id == model_id)
        .order_by(GDDModelParameters.effective_from.desc())
    )
    history = result.scalars().all()
    if not history:
        return []
    return history


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


@router.put("/{model_id}/parameters", response_model=GDDModelRead)
async def update_gdd_parameters(
    model_id: int, update: GDDParameterUpdate, db: AsyncSession = Depends(get_db)
):
    db_model = await db.get(GDDModel, model_id)
    if not db_model:
        raise HTTPException(status_code=404, detail="GDD model not found")

    # Determine effective date
    effective_from = update.effective_from or datetime_date.today()

    # Get current parameters for comparison
    current_params = {
        "base_temp": db_model.base_temp,
        "threshold": db_model.threshold,
        "reset_on_threshold": db_model.reset_on_threshold,
    }

    # Prepare new parameters
    new_params = {
        "base_temp": update.base_temp
        if update.base_temp is not None
        else current_params["base_temp"],
        "threshold": update.threshold
        if update.threshold is not None
        else current_params["threshold"],
        "reset_on_threshold": update.reset_on_threshold
        if update.reset_on_threshold is not None
        else current_params["reset_on_threshold"],
    }

    # Update model with new parameters
    db_model.base_temp = new_params["base_temp"]
    db_model.threshold = new_params["threshold"]
    db_model.reset_on_threshold = new_params["reset_on_threshold"]
    await db.commit()
    await db.refresh(db_model)

    # Store parameter history
    def sync_store_params():
        with SessionLocal() as sync_session:
            store_parameter_history(
                sync_session,
                model_id,
                new_params["base_temp"],
                new_params["threshold"],
                new_params["reset_on_threshold"],
                effective_from,
            )

    await run_in_threadpool(sync_store_params)

    # Handle historical recalculation if requested
    if update.recalculate_history:
        lawn = await db.get(Lawn, db_model.lawn_id)
        if not lawn:
            raise HTTPException(status_code=400, detail="Lawn not found for GDD model.")

        def sync_recalc():
            with SessionLocal() as sync_session:
                recalculate_historical_gdd(sync_session, model_id, effective_from)

        await run_in_threadpool(sync_recalc)
    else:
        # Just recalculate from effective date forward
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
    # First get the reset to determine the date range
    reset_result = await db.execute(
        select(GDDReset)
        .where(GDDReset.gdd_model_id == model_id, GDDReset.run_number == run_number)
        .order_by(GDDReset.reset_date.asc())
    )
    reset = reset_result.scalar_one_or_none()
    if not reset:
        raise HTTPException(status_code=404, detail="Run not found")

    # Get the next reset to determine end date
    # We want the first reset that occurs after our current reset
    next_reset_result = await db.execute(
        select(GDDReset)
        .where(
            GDDReset.gdd_model_id == model_id, GDDReset.reset_date > reset.reset_date
        )
        .order_by(GDDReset.reset_date.asc())
        .limit(1)  # Only get the first next reset
    )
    next_reset = next_reset_result.scalar_one_or_none()

    # Get values for this run
    values_query = (
        select(GDDValue)
        .where(GDDValue.gdd_model_id == model_id, GDDValue.run == run_number)
        .order_by(GDDValue.date.asc())
    )

    result = await db.execute(values_query)
    values = result.scalars().all()

    # Get the effective parameters for this run
    # We want the most recent parameter set that was effective before or on the reset date
    params_result = await db.execute(
        select(GDDModelParameters)
        .where(
            GDDModelParameters.gdd_model_id == model_id,
            GDDModelParameters.effective_from <= reset.reset_date,
        )
        .order_by(GDDModelParameters.effective_from.desc())
        .limit(1)  # Only get the most recent one
    )
    effective_params = params_result.scalar_one_or_none()

    # If no parameter history found, get the current model parameters
    if not effective_params:
        model = await db.get(GDDModel, model_id)
        if not model:
            raise HTTPException(status_code=404, detail="GDD model not found")
        effective_params = {
            "base_temp": model.base_temp,
            "threshold": model.threshold,
            "reset_on_threshold": model.reset_on_threshold,
        }
    else:
        # Convert SQLAlchemy model to dict
        effective_params = {
            "base_temp": effective_params.base_temp,
            "threshold": effective_params.threshold,
            "reset_on_threshold": effective_params.reset_on_threshold,
        }

    # Add effective parameters to each value
    for value in values:
        value.effective_params = effective_params

    return values


@router.delete("/{model_id}/resets/{reset_id}", status_code=status.HTTP_200_OK)
async def delete_gdd_reset(
    model_id: int, reset_id: int, db: AsyncSession = Depends(get_db)
):
    # Fetch the reset to delete
    reset = await db.get(GDDReset, reset_id)
    if not reset or reset.gdd_model_id != model_id:
        raise HTTPException(status_code=404, detail="Reset not found")
    # Prevent deleting the initial reset (earliest reset for the model)
    result = await db.execute(
        select(GDDReset)
        .where(GDDReset.gdd_model_id == model_id)
        .order_by(GDDReset.reset_date.asc())
    )
    resets = result.scalars().all()
    if resets and resets[0].id == reset_id:
        raise HTTPException(status_code=400, detail="Cannot delete the initial reset.")
    # Delete the reset
    await db.delete(reset)
    await db.commit()
    # Recalculate GDD values and threshold resets
    model = await db.get(GDDModel, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="GDD model not found")
    lawn = await db.get(Lawn, model.lawn_id)
    if not lawn:
        raise HTTPException(status_code=404, detail="Lawn not found for GDD model.")

    # Run recalculation in threadpool (sync)
    def sync_calc():
        with SessionLocal() as sync_session:
            calculate_and_store_gdd_values_sync_segmented(
                sync_session, model_id, lawn.location_id
            )

    await run_in_threadpool(sync_calc)
    return {"message": "Reset deleted and GDD values recalculated."}

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db, SessionLocal
from app.models.gdd import (
    GDDModel,
    GDDValue,
    GDDReset,
    ResetType,
    GDDModelParameters,
)
from app.schemas.gdd import (
    GDDModelCreate,
    GDDModelUpdate,
    GDDModelRead,
    GDDValueRead,
    GDDResetRead,
    GDDParameterUpdate,
    GDDParameterHistory,
    GDDModelDashboardRead,
)
from typing import List
from datetime import date as datetime_date
from app.utils.gdd import (
    calculate_and_store_gdd_values_sync_segmented,
    manual_gdd_reset_sync,
    recalculate_historical_gdd,
    store_parameter_history,
)
from app.models.lawn import Lawn
from app.models.location import Location
from datetime import datetime
import time

try:
    from asyncio import run_in_threadpool
except ImportError:
    from concurrent.futures import ThreadPoolExecutor
    import asyncio

    def run_in_threadpool(func, *args, **kwargs):
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as executor:
            return loop.run_in_executor(executor, lambda: func(*args, **kwargs))


router = APIRouter(prefix="/gdd_models", tags=["gdd_models"])


@router.get("/", response_model=List[GDDModelRead])
async def list_all_gdd_models(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GDDModel))
    return result.scalars().all()


@router.post("/", response_model=GDDModelRead, status_code=status.HTTP_201_CREATED)
async def create_gdd_model(model: GDDModelCreate, db: AsyncSession = Depends(get_db)):
    # Check for unique name per location
    existing = await db.execute(
        select(GDDModel).where(
            GDDModel.location_id == model.location_id, GDDModel.name == model.name
        )
    )
    if existing.scalars().first():
        raise HTTPException(
            status_code=400, detail="GDD model name must be unique per location."
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
    # Need to get location_id from the model
    location = await db.get(Location, db_model.location_id)
    if not location:
        raise HTTPException(status_code=400, detail="Location not found for GDD model.")

    def sync_calc():
        with SessionLocal() as sync_session:
            calculate_and_store_gdd_values_sync_segmented(
                sync_session, db_model.id, location.id
            )

    await run_in_threadpool(sync_calc)
    return db_model


@router.get("/location/{location_id}", response_model=List[GDDModelRead])
async def list_gdd_models_by_location(
    location_id: int, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(GDDModel).where(GDDModel.location_id == location_id)
    )
    return result.scalars().all()


@router.get("/lawn/{lawn_id}", response_model=List[GDDModelRead])
async def list_gdd_models_by_lawn(lawn_id: int, db: AsyncSession = Depends(get_db)):
    # Get the lawn to find its location_id
    lawn = await db.get(Lawn, lawn_id)
    if not lawn:
        raise HTTPException(status_code=404, detail="Lawn not found")

    result = await db.execute(
        select(GDDModel).where(GDDModel.location_id == lawn.location_id)
    )
    return result.scalars().all()


@router.get("/{model_id}", response_model=GDDModelRead)
async def get_gdd_model(model_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GDDModel).where(GDDModel.id == model_id))
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
    location = await db.get(Location, db_model.location_id)
    if not location:
        raise HTTPException(status_code=400, detail="Location not found for GDD model.")

    def sync_calc():
        with SessionLocal() as sync_session:
            calculate_and_store_gdd_values_sync_segmented(
                sync_session, db_model.id, location.id
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

    # Store current parameters in history if any are changing
    effective_from = update.effective_from or datetime_date.today()
    if any(
        [
            update.base_temp is not None and update.base_temp != db_model.base_temp,
            update.threshold is not None and update.threshold != db_model.threshold,
            update.reset_on_threshold is not None
            and update.reset_on_threshold != db_model.reset_on_threshold,
        ]
    ):

        def sync_store_params():
            with SessionLocal() as sync_session:
                store_parameter_history(
                    sync_session,
                    db_model.id,
                    update.base_temp or db_model.base_temp,
                    update.threshold or db_model.threshold,
                    update.reset_on_threshold
                    if update.reset_on_threshold is not None
                    else db_model.reset_on_threshold,
                    effective_from,
                )

        await run_in_threadpool(sync_store_params)

    # Update model parameters
    if update.base_temp is not None:
        db_model.base_temp = update.base_temp
    if update.threshold is not None:
        db_model.threshold = update.threshold
    if update.reset_on_threshold is not None:
        db_model.reset_on_threshold = update.reset_on_threshold

    await db.commit()
    await db.refresh(db_model)

    # Handle historical recalculation if requested
    if update.recalculate_history:
        location = await db.get(Location, db_model.location_id)
        if not location:
            raise HTTPException(
                status_code=400, detail="Location not found for GDD model."
            )

        def sync_recalc():
            with SessionLocal() as sync_session:
                recalculate_historical_gdd(sync_session, model_id, effective_from)

        await run_in_threadpool(sync_recalc)
    else:
        # Just recalculate from effective date forward
        location = await db.get(Location, db_model.location_id)
        if not location:
            raise HTTPException(
                status_code=400, detail="Location not found for GDD model."
            )

        def sync_calc():
            with SessionLocal() as sync_session:
                calculate_and_store_gdd_values_sync_segmented(
                    sync_session, db_model.id, location.id
                )

        await run_in_threadpool(sync_calc)

    return db_model


@router.post("/{model_id}/reset", status_code=status.HTTP_200_OK)
async def reset_gdd_model(
    model_id: int, reset_date: str, db: AsyncSession = Depends(get_db)
):
    try:
        reset_date_obj = datetime_date.fromisoformat(reset_date)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid reset_date format. Use YYYY-MM-DD."
        )
    db_model = await db.get(GDDModel, model_id)
    location = await db.get(Location, db_model.location_id)

    def sync_reset():
        with SessionLocal() as sync_session:
            manual_gdd_reset_sync(sync_session, model_id, reset_date_obj)
            calculate_and_store_gdd_values_sync_segmented(
                sync_session, db_model.id, location.id
            )

    await run_in_threadpool(sync_reset)
    return {"message": "GDD model reset and recalculated."}


@router.get("/{model_id}/resets", response_model=List[GDDResetRead])
async def get_gdd_resets(model_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GDDReset).where(GDDReset.gdd_model_id == model_id))
    return result.scalars().all()


@router.delete("/{model_id}/resets/{reset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gdd_reset(
    model_id: int, reset_id: int, db: AsyncSession = Depends(get_db)
):
    reset = await db.get(GDDReset, reset_id)
    if not reset or reset.gdd_model_id != model_id:
        raise HTTPException(status_code=404, detail="Reset not found")

    await db.delete(reset)
    await db.commit()

    # Recalculate GDD values after reset deletion
    db_model = await db.get(GDDModel, model_id)
    location = await db.get(Location, db_model.location_id)

    def sync_recalc():
        with SessionLocal() as sync_session:
            calculate_and_store_gdd_values_sync_segmented(
                sync_session, db_model.id, location.id
            )

    await run_in_threadpool(sync_recalc)


@router.get("/{model_id}/history", response_model=List[GDDParameterHistory])
async def get_gdd_parameter_history(model_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(GDDModelParameters)
        .where(GDDModelParameters.gdd_model_id == model_id)
        .order_by(GDDModelParameters.effective_from.desc())
    )
    return result.scalars().all()


@router.get("/{model_id}/runs/{run_number}/values", response_model=List[GDDValueRead])
async def get_gdd_values(
    model_id: int, run_number: int, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(GDDValue).where(
            GDDValue.gdd_model_id == model_id, GDDValue.run == run_number
        )
    )
    return result.scalars().all()


@router.delete("/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gdd_model(model_id: int, db: AsyncSession = Depends(get_db)):
    db_model = await db.get(GDDModel, model_id)
    if not db_model:
        raise HTTPException(status_code=404, detail="GDD model not found")
    await db.delete(db_model)
    await db.commit()


@router.get(
    "/location/{location_id}/dashboard", response_model=List[GDDModelDashboardRead]
)
async def list_gdd_models_dashboard_by_location(
    location_id: int, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(GDDModel).where(GDDModel.location_id == location_id)
    )
    models = result.scalars().all()
    dashboard_models = []
    today = datetime_date.today()

    now = datetime.now()
    utcnow = datetime.utcnow()
    print(
        f"Backend datetime.now(): {now.isoformat()} | datetime.utcnow(): {utcnow.isoformat()} | date.today(): {today.isoformat()} | Server timezone: {time.tzname}"
    )

    for model in models:
        # Get latest reset that is not in the future
        reset_result = await db.execute(
            select(GDDReset)
            .where(GDDReset.gdd_model_id == model.id, GDDReset.reset_date <= today)
            .order_by(GDDReset.reset_date.desc())
            .limit(1)
        )
        latest_reset = reset_result.scalars().first()

        if latest_reset:
            run_number = latest_reset.run_number
            last_reset = latest_reset.reset_date
        else:
            # fallback: get the latest reset regardless of date
            reset_result = await db.execute(
                select(GDDReset)
                .where(GDDReset.gdd_model_id == model.id)
                .order_by(GDDReset.reset_date.desc())
                .limit(1)
            )
            fallback_reset = reset_result.scalars().first()
            run_number = fallback_reset.run_number if fallback_reset else 1
            last_reset = fallback_reset.reset_date if fallback_reset else None

        # Get GDD value for today or the most recent date <= today for that run
        gdd_result = await db.execute(
            select(GDDValue)
            .where(
                GDDValue.gdd_model_id == model.id,
                GDDValue.run == run_number,
                GDDValue.date <= today,
            )
            .order_by(GDDValue.date.desc())
            .limit(1)
        )
        latest_gdd = gdd_result.scalars().first()
        current_gdd = latest_gdd.cumulative_gdd if latest_gdd else 0.0

        dashboard_models.append(
            GDDModelDashboardRead(
                id=model.id,
                location_id=model.location_id,
                name=model.name,
                base_temp=model.base_temp,
                unit=model.unit,
                threshold=model.threshold,
                created_at=model.created_at,
                updated_at=model.updated_at,
                current_gdd=current_gdd,
                last_reset=last_reset,
                run_number=run_number,
            )
        )
    return dashboard_models

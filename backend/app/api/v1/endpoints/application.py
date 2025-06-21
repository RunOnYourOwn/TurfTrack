from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.core.database import get_db, SessionLocal
from app.models.application import Application
from app.schemas.application import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationRead,
)
from typing import List, Optional
from app.models.gdd import GDDReset, ResetType, GDDModel
from app.utils.gdd import calculate_and_store_gdd_values_sync_segmented
from app.utils.application import calculate_application_results
from app.models.lawn import Lawn
from app.models.product import Product

router = APIRouter(prefix="/applications", tags=["applications"])


@router.get("/", response_model=List[ApplicationRead])
async def list_applications(
    lawn_id: Optional[int] = Query(None), db: AsyncSession = Depends(get_db)
):
    query = select(Application)
    if lawn_id is not None:
        query = query.where(Application.lawn_id == lawn_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{application_id}", response_model=ApplicationRead)
async def get_application(application_id: int, db: AsyncSession = Depends(get_db)):
    app = await db.get(Application, application_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.post(
    "/", response_model=List[ApplicationRead], status_code=status.HTTP_201_CREATED
)
async def create_application(
    application_in: ApplicationCreate, db: AsyncSession = Depends(get_db)
):
    lawn_ids = application_in.lawn_ids or (
        [application_in.lawn_id] if application_in.lawn_id is not None else None
    )
    if not lawn_ids:
        raise HTTPException(
            status_code=400, detail="Must provide at least one lawn_id or lawn_ids"
        )
    created_apps = []
    for lawn_id in lawn_ids:
        app_data = application_in.dict(exclude_unset=True, exclude={"lawn_ids"})
        app_data["lawn_id"] = lawn_id
        if app_data.get("tied_gdd_model_id") in (0, "0"):
            app_data["tied_gdd_model_id"] = None
        db_app = Application(**app_data)
        # Fetch product and lawn for calculations
        product = await db.get(Product, db_app.product_id)
        lawn = await db.get(Lawn, db_app.lawn_id)
        if product and lawn:
            results = calculate_application_results(db_app, product, lawn)
            for k, v in results.items():
                setattr(db_app, k, v)
        db.add(db_app)
        created_apps.append(db_app)
    await db.commit()
    for db_app in created_apps:
        await db.refresh(db_app, attribute_names=["lawn", "product"])
        # GDD reset and recalculation logic
        if db_app.tied_gdd_model_id:
            # Remove any existing reset for this date
            await db.execute(
                GDDReset.__table__.delete().where(
                    (GDDReset.gdd_model_id == db_app.tied_gdd_model_id)
                    & (GDDReset.reset_date == db_app.application_date)
                )
            )
            await db.commit()
            # Find current max run_number in gdd_resets
            result = await db.execute(
                select(func.max(GDDReset.run_number)).where(
                    GDDReset.gdd_model_id == db_app.tied_gdd_model_id
                )
            )
            max_run = result.scalar() or 0
            next_run = max_run + 1
            # Insert new application reset
            reset = GDDReset(
                gdd_model_id=db_app.tied_gdd_model_id,
                reset_date=db_app.application_date,
                run_number=next_run,
                reset_type=ResetType.application,
            )
            db.add(reset)
            await db.commit()
            # Delete all future resets after the application reset date
            await db.execute(
                GDDReset.__table__.delete().where(
                    (GDDReset.gdd_model_id == db_app.tied_gdd_model_id)
                    & (GDDReset.reset_date > db_app.application_date)
                )
            )
            await db.commit()
            # Recalculate GDD values (sync version, so use a sync session)
            with SessionLocal() as sync_session:
                gdd_model = sync_session.get(GDDModel, db_app.tied_gdd_model_id)
                if gdd_model:
                    calculate_and_store_gdd_values_sync_segmented(
                        sync_session, gdd_model.id, gdd_model.lawn.location_id
                    )
    return created_apps


@router.put("/{application_id}", response_model=ApplicationRead)
async def update_application(
    application_id: int, update: ApplicationUpdate, db: AsyncSession = Depends(get_db)
):
    db_app = await db.get(Application, application_id)
    if not db_app:
        raise HTTPException(status_code=404, detail="Application not found")
    for field, value in update.dict(exclude_unset=True).items():
        setattr(db_app, field, value)
    # Fetch product and lawn for calculations
    product = await db.get(Product, db_app.product_id)
    lawn = await db.get(Lawn, db_app.lawn_id)
    if product and lawn:
        results = calculate_application_results(db_app, product, lawn)
        for k, v in results.items():
            setattr(db_app, k, v)
    await db.commit()
    await db.refresh(db_app)
    return db_app


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(application_id: int, db: AsyncSession = Depends(get_db)):
    db_app = await db.get(Application, application_id)
    if not db_app:
        raise HTTPException(status_code=404, detail="Application not found")
    await db.delete(db_app)
    await db.commit()

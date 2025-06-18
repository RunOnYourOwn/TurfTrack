from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.application import Application
from app.schemas.application import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationRead,
)
from typing import List, Optional

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
    lawn_ids = application_in.lawn_ids or [application_in.lawn_id]
    created_apps = []
    for lawn_id in lawn_ids:
        app_data = application_in.dict(exclude_unset=True, exclude={"lawn_ids"})
        app_data["lawn_id"] = lawn_id
        db_app = Application(**app_data)
        db.add(db_app)
        created_apps.append(db_app)
    await db.commit()
    for db_app in created_apps:
        await db.refresh(db_app)
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

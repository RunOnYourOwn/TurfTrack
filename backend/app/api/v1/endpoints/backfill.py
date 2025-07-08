from fastapi import APIRouter
from pydantic import BaseModel
from datetime import date
from app.tasks.weather import (
    backfill_weather_for_location,
    backfill_gdd_for_model,
    backfill_disease_pressure_for_location,
    backfill_growth_potential_for_location,
)

router = APIRouter(prefix="/backfill", tags=["backfill"])


class WeatherBackfillRequest(BaseModel):
    location_id: int
    start_date: date
    end_date: date


class GDDBackfillRequest(BaseModel):
    gdd_model_id: int


class DiseasePressureBackfillRequest(BaseModel):
    location_id: int
    start_date: date
    end_date: date


class GrowthPotentialBackfillRequest(BaseModel):
    location_id: int
    start_date: date
    end_date: date


@router.post("/weather/")
async def weather_backfill(request: WeatherBackfillRequest):
    # Trigger new Celery backfill task
    celery_result = backfill_weather_for_location.delay(
        request.location_id,
        str(request.start_date),
        str(request.end_date),
    )
    return {"task_id": celery_result.id, "status": "started"}


@router.post("/gdd/")
async def gdd_backfill(request: GDDBackfillRequest):
    celery_result = backfill_gdd_for_model.delay(request.gdd_model_id)
    return {"task_id": celery_result.id, "status": "started"}


@router.post("/disease_pressure/")
async def disease_pressure_backfill(request: DiseasePressureBackfillRequest):
    celery_result = backfill_disease_pressure_for_location.delay(
        request.location_id,
        str(request.start_date),
        str(request.end_date),
    )
    return {"task_id": celery_result.id, "status": "started"}


@router.post("/growth_potential/")
async def growth_potential_backfill(request: GrowthPotentialBackfillRequest):
    celery_result = backfill_growth_potential_for_location.delay(
        request.location_id,
        str(request.start_date),
        str(request.end_date),
    )
    return {"task_id": celery_result.id, "status": "started"}

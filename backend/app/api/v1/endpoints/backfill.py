from fastapi import APIRouter, Request
from pydantic import BaseModel
from datetime import date, datetime, timezone
from app.tasks.weather import (
    backfill_weather_for_location,
    backfill_gdd_for_model,
    backfill_disease_pressure_for_location,
    backfill_growth_potential_for_location,
)
from app.core.database import SessionLocal
from app.models.task_status import TaskStatus, TaskStatusEnum
import logging
from sqlalchemy.dialects.postgresql import insert

logger = logging.getLogger(__name__)

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


def create_initial_task_status(
    task_id: str, task_name: str, location_id: int, request_id: str = None
):
    """Create initial task status record when task is queued"""
    with SessionLocal() as session:
        now = datetime.now(timezone.utc)
        insert_stmt = insert(TaskStatus).values(
            task_id=task_id,
            task_name=task_name,
            related_location_id=location_id,
            status=TaskStatusEnum.pending,
            created_at=now,
            request_id=request_id,  # Save request_id
        )
        update_dict = {
            "status": TaskStatusEnum.pending,
            "task_name": task_name,
            "related_location_id": location_id,
            "created_at": now,
            "request_id": request_id,  # Save request_id
        }
        upsert_stmt = insert_stmt.on_conflict_do_update(
            index_elements=["task_id"],
            set_=update_dict,
        )
        session.execute(upsert_stmt)
        session.commit()


@router.post("/weather/")
async def weather_backfill(request: Request, body: WeatherBackfillRequest):
    try:
        request_id = request.state.request_id
        logger.info(f"Queuing weather backfill task for location {body.location_id}")
        celery_result = backfill_weather_for_location.apply_async(
            args=[body.location_id, str(body.start_date), str(body.end_date)],
            headers={"request_id": request_id},
        )
        logger.info(f"Weather backfill task queued with ID: {celery_result.id}")
        create_initial_task_status(
            celery_result.id,
            "backfill_weather_for_location",
            body.location_id,
            request_id,
        )
        return {"task_id": celery_result.id, "status": "started"}
    except Exception as e:
        logger.error(f"Failed to queue weather backfill task: {e}")
        raise


@router.post("/gdd/")
async def gdd_backfill(request: Request, body: GDDBackfillRequest):
    try:
        request_id = request.state.request_id
        logger.info(f"Queuing GDD backfill task for model {body.gdd_model_id}")
        celery_result = backfill_gdd_for_model.apply_async(
            args=[body.gdd_model_id],
            headers={"request_id": request_id},
        )
        logger.info(f"GDD backfill task queued with ID: {celery_result.id}")
        create_initial_task_status(
            celery_result.id,
            "backfill_gdd_for_model",
            body.gdd_model_id,  # Use gdd_model_id as location_id for tracking
            request_id,
        )
        return {"task_id": celery_result.id, "status": "started"}
    except Exception as e:
        logger.error(f"Failed to queue GDD backfill task: {e}")
        raise


@router.post("/disease_pressure/")
async def disease_pressure_backfill(
    request: Request, body: DiseasePressureBackfillRequest
):
    try:
        request_id = request.state.request_id
        logger.info(
            f"Queuing disease pressure backfill task for location {body.location_id}"
        )
        celery_result = backfill_disease_pressure_for_location.apply_async(
            args=[body.location_id, str(body.start_date), str(body.end_date)],
            headers={"request_id": request_id},
        )
        logger.info(
            f"Disease pressure backfill task queued with ID: {celery_result.id}"
        )
        create_initial_task_status(
            celery_result.id,
            "backfill_disease_pressure_for_location",
            body.location_id,
            request_id,
        )
        return {"task_id": celery_result.id, "status": "started"}
    except Exception as e:
        logger.error(f"Failed to queue disease pressure backfill task: {e}")
        raise


@router.post("/growth_potential/")
async def growth_potential_backfill(
    request: Request, body: GrowthPotentialBackfillRequest
):
    try:
        request_id = request.state.request_id
        logger.info(
            f"Queuing growth potential backfill task for location {body.location_id}"
        )
        celery_result = backfill_growth_potential_for_location.apply_async(
            args=[body.location_id, str(body.start_date), str(body.end_date)],
            headers={"request_id": request_id},
        )
        logger.info(
            f"Growth potential backfill task queued with ID: {celery_result.id}"
        )
        create_initial_task_status(
            celery_result.id,
            "backfill_growth_potential_for_location",
            body.location_id,
            request_id,
        )
        return {"task_id": celery_result.id, "status": "started"}
    except Exception as e:
        logger.error(f"Failed to queue growth potential backfill task: {e}")
        raise

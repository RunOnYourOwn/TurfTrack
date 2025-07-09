from fastapi import APIRouter
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
from sqlalchemy.future import select
import logging

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


def create_initial_task_status(task_id: str, task_name: str, location_id: int):
    """Create initial task status record when task is queued"""
    with SessionLocal() as session:
        # Check if record already exists
        stmt = select(TaskStatus).where(TaskStatus.task_id == task_id)
        result = session.execute(stmt)
        existing_status = result.scalar_one_or_none()

        if existing_status:
            # Update existing record
            existing_status.status = TaskStatusEnum.pending
            existing_status.created_at = datetime.now(timezone.utc)
        else:
            # Create new record
            task_status = TaskStatus(
                task_id=task_id,
                task_name=task_name,
                related_location_id=location_id,
                status=TaskStatusEnum.pending,
                created_at=datetime.now(timezone.utc),
            )
            session.add(task_status)

        session.commit()


@router.post("/weather/")
async def weather_backfill(request: WeatherBackfillRequest):
    try:
        # Trigger new Celery backfill task
        logger.info(f"Queuing weather backfill task for location {request.location_id}")
        celery_result = backfill_weather_for_location.delay(
            request.location_id,
            str(request.start_date),
            str(request.end_date),
        )
        logger.info(f"Weather backfill task queued with ID: {celery_result.id}")

        # Create initial task status record
        create_initial_task_status(
            celery_result.id, "backfill_weather_for_location", request.location_id
        )

        return {"task_id": celery_result.id, "status": "started"}
    except Exception as e:
        logger.error(f"Failed to queue weather backfill task: {e}")
        raise


@router.post("/gdd/")
async def gdd_backfill(request: GDDBackfillRequest):
    try:
        logger.info(f"Queuing GDD backfill task for model {request.gdd_model_id}")
        celery_result = backfill_gdd_for_model.delay(request.gdd_model_id)
        logger.info(f"GDD backfill task queued with ID: {celery_result.id}")

        # Create initial task status record
        create_initial_task_status(
            celery_result.id,
            "backfill_gdd_for_model",
            request.gdd_model_id,  # Use gdd_model_id as location_id for tracking
        )

        return {"task_id": celery_result.id, "status": "started"}
    except Exception as e:
        logger.error(f"Failed to queue GDD backfill task: {e}")
        raise


@router.post("/disease_pressure/")
async def disease_pressure_backfill(request: DiseasePressureBackfillRequest):
    try:
        logger.info(
            f"Queuing disease pressure backfill task for location {request.location_id}"
        )
        celery_result = backfill_disease_pressure_for_location.delay(
            request.location_id,
            str(request.start_date),
            str(request.end_date),
        )
        logger.info(
            f"Disease pressure backfill task queued with ID: {celery_result.id}"
        )

        # Create initial task status record
        create_initial_task_status(
            celery_result.id,
            "backfill_disease_pressure_for_location",
            request.location_id,
        )

        return {"task_id": celery_result.id, "status": "started"}
    except Exception as e:
        logger.error(f"Failed to queue disease pressure backfill task: {e}")
        raise


@router.post("/growth_potential/")
async def growth_potential_backfill(request: GrowthPotentialBackfillRequest):
    try:
        logger.info(
            f"Queuing growth potential backfill task for location {request.location_id}"
        )
        celery_result = backfill_growth_potential_for_location.delay(
            request.location_id,
            str(request.start_date),
            str(request.end_date),
        )
        logger.info(
            f"Growth potential backfill task queued with ID: {celery_result.id}"
        )

        # Create initial task status record
        create_initial_task_status(
            celery_result.id,
            "backfill_growth_potential_for_location",
            request.location_id,
        )

        return {"task_id": celery_result.id, "status": "started"}
    except Exception as e:
        logger.error(f"Failed to queue growth potential backfill task: {e}")
        raise

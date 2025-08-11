import datetime
from app.celery_app import app
from app.core.database import SessionLocal
from app.models.task_status import TaskStatus, TaskStatusEnum
from app.utils.water_management import (
    calculate_weekly_water_summaries_for_location,
    recalculate_weekly_water_summaries_for_lawn,
)
from app.models.location import Location
from app.models.lawn import Lawn
import logging

logger = logging.getLogger(__name__)


def create_or_update_task_status_sync(
    session,
    task_id: str,
    task_name: str,
    related_location_id: int = None,
    status: TaskStatusEnum = TaskStatusEnum.pending,
    started: bool = False,
    finished: bool = False,
    request_id: str = None,
):
    """Create or update a task status record."""
    from sqlalchemy.dialects.postgresql import insert

    now = datetime.datetime.now(datetime.timezone.utc)

    # Use UPSERT operation to handle conflicts properly
    insert_stmt = insert(TaskStatus).values(
        task_id=task_id,
        task_name=task_name,
        related_location_id=related_location_id,
        status=status,
        created_at=now,
        started_at=now if started else None,
        finished_at=now if finished else None,
        request_id=request_id,
    )

    update_dict = {
        "task_name": task_name,
        "related_location_id": related_location_id,
        "status": status,
        "request_id": request_id,
    }

    if started:
        update_dict["started_at"] = now
    if finished:
        update_dict["finished_at"] = now
        if status == TaskStatusEnum.success:
            update_dict["result"] = "Task completed successfully"
        elif status == TaskStatusEnum.failure:
            update_dict["error"] = "Task failed"

    upsert_stmt = insert_stmt.on_conflict_do_update(
        index_elements=["task_id"],
        set_=update_dict,
    )

    session.execute(upsert_stmt)
    session.commit()


@app.task(name="calculate_weekly_water_summaries_for_location", bind=True)
def calculate_weekly_water_summaries_for_location_task(
    self, location_id: int, start_date: str = None, end_date: str = None
):
    """
    Calculate and store weekly water summaries for all lawns at a location.
    This task is typically triggered after weather data updates.
    """
    task_id = self.request.id
    request_id = (
        self.request.headers.get("request_id") if self.request.headers else None
    )

    try:
        with SessionLocal() as session:
            # Create task status record
            create_or_update_task_status_sync(
                session,
                task_id,
                "calculate_weekly_water_summaries_for_location",
                location_id,
                TaskStatusEnum.started,
                started=True,
                request_id=request_id,
            )

            # Parse dates
            if start_date:
                start_date_obj = datetime.datetime.strptime(
                    start_date, "%Y-%m-%d"
                ).date()
            else:
                # Default to match weather data range: 60 days ago to 16 days in future
                start_date_obj = datetime.date.today() - datetime.timedelta(days=60)

            if end_date:
                end_date_obj = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()
            else:
                # Default to 16 days in future (matching weather data range)
                end_date_obj = datetime.date.today() + datetime.timedelta(days=16)

            # Verify location exists
            location = session.get(Location, location_id)
            if not location:
                raise ValueError(f"Location {location_id} not found")

            # Calculate weekly summaries
            processed_count = calculate_weekly_water_summaries_for_location(
                session, location_id, start_date_obj, end_date_obj
            )

            # Update task status
            create_or_update_task_status_sync(
                session,
                task_id,
                "calculate_weekly_water_summaries_for_location",
                location_id,
                TaskStatusEnum.success,
                finished=True,
                request_id=request_id,
            )

            logger.info(
                f"Completed weekly water summary calculation for location {location_id}: "
                f"{processed_count} summaries processed",
                extra={"request_id": request_id},
            )

            return {
                "location_id": location_id,
                "summaries_processed": processed_count,
                "start_date": start_date_obj.isoformat(),
                "end_date": end_date_obj.isoformat(),
            }

    except Exception as e:
        logger.error(
            f"Weekly water summary calculation failed for location {location_id}: {e}",
            extra={"request_id": request_id},
        )

        # Update task status to failed
        try:
            with SessionLocal() as session:
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "calculate_weekly_water_summaries_for_location",
                    location_id,
                    TaskStatusEnum.failure,
                    finished=True,
                    request_id=request_id,
                )
        except Exception:
            pass

        raise


@app.task(name="recalculate_weekly_water_summaries_for_lawn", bind=True)
def recalculate_weekly_water_summaries_for_lawn_task(self, lawn_id: int):
    """
    Recalculate weekly water summaries for a specific lawn.
    This task is typically triggered when new irrigation entries are added.
    """
    task_id = self.request.id
    request_id = (
        self.request.headers.get("request_id") if self.request.headers else None
    )

    try:
        with SessionLocal() as session:
            # Create task status record
            create_or_update_task_status_sync(
                session,
                task_id,
                "recalculate_weekly_water_summaries_for_lawn",
                None,  # No location_id for lawn-specific tasks
                TaskStatusEnum.started,
                started=True,
                request_id=request_id,
            )

            # Verify lawn exists
            lawn = session.get(Lawn, lawn_id)
            if not lawn:
                raise ValueError(f"Lawn {lawn_id} not found")

            # Recalculate weekly summaries
            processed_count = recalculate_weekly_water_summaries_for_lawn(
                session, lawn_id
            )

            # Update task status
            create_or_update_task_status_sync(
                session,
                task_id,
                "recalculate_weekly_water_summaries_for_lawn",
                None,
                TaskStatusEnum.success,
                finished=True,
                request_id=request_id,
            )

            logger.info(
                f"Completed weekly water summary recalculation for lawn {lawn_id}: "
                f"{processed_count} summaries processed",
                extra={"request_id": request_id},
            )

            return {
                "lawn_id": lawn_id,
                "summaries_processed": processed_count,
            }

    except Exception as e:
        logger.error(
            f"Weekly water summary recalculation failed for lawn {lawn_id}: {e}",
            extra={"request_id": request_id},
        )

        # Update task status to failed
        try:
            with SessionLocal() as session:
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "recalculate_weekly_water_summaries_for_lawn",
                    None,
                    TaskStatusEnum.failure,
                    finished=True,
                    request_id=request_id,
                )
        except Exception:
            pass

        raise


@app.task(name="initialize_water_summaries_for_new_lawn", bind=True)
def initialize_water_summaries_for_new_lawn_task(self, lawn_id: int):
    """
    Initialize weekly water summaries for a newly created lawn.
    This task is triggered when a new lawn is added to an existing location.
    """
    task_id = self.request.id
    request_id = (
        self.request.headers.get("request_id") if self.request.headers else None
    )

    try:
        with SessionLocal() as session:
            # Create task status record
            create_or_update_task_status_sync(
                session,
                task_id,
                "initialize_water_summaries_for_new_lawn",
                None,  # No location_id for lawn-specific tasks
                TaskStatusEnum.started,
                started=True,
                request_id=request_id,
            )

            # Verify lawn exists
            lawn = session.get(Lawn, lawn_id)
            if not lawn:
                raise ValueError(f"Lawn {lawn_id} not found")

            # Calculate weekly summaries for the new lawn using existing weather data
            # Use the same date range as the weather data (60 days ago to 16 days in future)
            today = datetime.date.today()
            start_date = today - datetime.timedelta(days=60)
            end_date = today + datetime.timedelta(days=16)

            processed_count = calculate_weekly_water_summaries_for_location(
                session, lawn.location_id, start_date, end_date
            )

            # Update task status
            create_or_update_task_status_sync(
                session,
                task_id,
                "initialize_water_summaries_for_new_lawn",
                None,
                TaskStatusEnum.success,
                finished=True,
                request_id=request_id,
            )

            logger.info(
                f"Completed water summary initialization for new lawn {lawn_id}: "
                f"{processed_count} summaries processed",
                extra={"request_id": request_id},
            )

            return {
                "lawn_id": lawn_id,
                "location_id": lawn.location_id,
                "summaries_processed": processed_count,
            }

    except Exception as e:
        logger.error(
            f"Water summary initialization failed for new lawn {lawn_id}: {e}",
            extra={"request_id": request_id},
        )

        # Update task status to failed
        try:
            with SessionLocal() as session:
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "initialize_water_summaries_for_new_lawn",
                    None,
                    TaskStatusEnum.failure,
                    finished=True,
                    request_id=request_id,
                )
        except Exception:
            pass

        raise

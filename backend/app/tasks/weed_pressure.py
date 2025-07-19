import datetime
from datetime import date, timedelta
from app.celery_app import app
from app.core.database import SessionLocal
from app.models.location import Location
from app.utils.weed_pressure import (
    calculate_weed_pressure_for_location,
    store_weed_pressure_data,
)
from app.models.task_status import TaskStatus, TaskStatusEnum
from sqlalchemy import select
import logging

logger = logging.getLogger(__name__)


def create_or_update_task_status_sync(
    session,
    task_id: str,
    task_name: str,
    location_id: int,
    status: TaskStatusEnum,
    started: bool = False,
    finished: bool = False,
    error: str = None,
    request_id: str = None,
):
    """Create or update task status record (synchronous version)."""
    from sqlalchemy.dialects.postgresql import insert
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    insert_stmt = insert(TaskStatus).values(
        task_id=task_id,
        task_name=task_name,
        related_location_id=location_id,
        status=status,
        created_at=now,
        request_id=request_id,
    )
    update_dict = {
        "status": status,
        "task_name": task_name,
        "related_location_id": location_id,
        "request_id": request_id,
    }

    if started:
        update_dict["started_at"] = now
    if finished:
        update_dict["finished_at"] = now
    if error:
        update_dict["error"] = error

    upsert_stmt = insert_stmt.on_conflict_do_update(
        index_elements=["task_id"],
        set_=update_dict,
    )
    session.execute(upsert_stmt)
    session.commit()


@app.task(name="calculate_weed_pressure_for_location", bind=True)
def calculate_weed_pressure_for_location_task(
    self, location_id: int, target_date: str = None
):
    """
    Calculate and store weed pressure data for a location.
    If no target_date is provided, calculates for today.
    Tracks progress in TaskStatus.
    """
    task_id = self.request.id
    request_id = self.request.headers.get("request_id")

    try:
        with SessionLocal() as session:
            # TaskStatus: started
            create_or_update_task_status_sync(
                session,
                task_id,
                "calculate_weed_pressure_for_location",
                location_id,
                TaskStatusEnum.started,
                started=True,
                request_id=request_id,
            )

            # Parse target date
            if target_date:
                target_date_obj = datetime.datetime.strptime(
                    target_date, "%Y-%m-%d"
                ).date()
            else:
                target_date_obj = date.today()

            # Verify location exists
            location = session.get(Location, location_id)
            if not location:
                raise ValueError(f"Location {location_id} not found")

            # Calculate weed pressure for all species
            weed_pressure_data = calculate_weed_pressure_for_location(
                session, location_id, target_date_obj
            )

            # Store the data
            stored_count = store_weed_pressure_data(session, weed_pressure_data)

            # TaskStatus: success
            create_or_update_task_status_sync(
                session,
                task_id,
                "calculate_weed_pressure_for_location",
                location_id,
                TaskStatusEnum.success,
                finished=True,
                request_id=request_id,
            )

            logger.info(
                f"Calculated weed pressure for location {location_id} on {target_date_obj}: "
                f"{stored_count} species processed",
                extra={"request_id": request_id},
            )

    except Exception as e:
        logger.error(
            f"Weed pressure calculation failed for location {location_id}: {e}",
            extra={"request_id": request_id},
        )
        try:
            with SessionLocal() as session:
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "calculate_weed_pressure_for_location",
                    location_id,
                    TaskStatusEnum.failure,
                    error=str(e),
                    finished=True,
                    request_id=request_id,
                )
        except Exception:
            pass
        raise


@app.task(name="calculate_weed_pressure_for_all_locations", bind=True)
def calculate_weed_pressure_for_all_locations_task(self):
    """
    Calculate weed pressure for all locations.
    Useful for daily scheduled updates.
    """
    request_id = self.request.headers.get("request_id")

    try:
        with SessionLocal() as session:
            # Get all locations
            locations = session.execute(select(Location)).scalars().all()

            logger.info(
                f"Starting weed pressure calculation for {len(locations)} locations",
                extra={"request_id": request_id},
            )

            for location in locations:
                try:
                    # Calculate for today
                    weed_pressure_data = calculate_weed_pressure_for_location(
                        session, location.id, date.today()
                    )
                    stored_count = store_weed_pressure_data(session, weed_pressure_data)

                    logger.info(
                        f"Calculated weed pressure for location {location.id} ({location.name}): "
                        f"{stored_count} species processed",
                        extra={"request_id": request_id},
                    )

                except Exception as e:
                    logger.error(
                        f"Failed to calculate weed pressure for location {location.id}: {e}",
                        extra={"request_id": request_id},
                    )
                    # Continue with other locations
                    continue

            logger.info(
                "Completed weed pressure calculation for all locations",
                extra={"request_id": request_id},
            )

    except Exception as e:
        logger.error(
            f"Weed pressure calculation for all locations failed: {e}",
            extra={"request_id": request_id},
        )
        raise


@app.task(name="backfill_weed_pressure_for_location", bind=True)
def backfill_weed_pressure_for_location_task(
    self, location_id: int, start_date: str, end_date: str
):
    """
    Backfill weed pressure data for a location and date range.
    Useful for historical data or when adding new weed species.
    """
    task_id = self.request.id
    request_id = self.request.headers.get("request_id")

    try:
        with SessionLocal() as session:
            # TaskStatus: started
            create_or_update_task_status_sync(
                session,
                task_id,
                "backfill_weed_pressure_for_location",
                location_id,
                TaskStatusEnum.started,
                started=True,
                request_id=request_id,
            )

            # Parse dates
            start_date_obj = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date_obj = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()

            # Verify location exists
            location = session.get(Location, location_id)
            if not location:
                raise ValueError(f"Location {location_id} not found")

            # Calculate for each date in range
            current_date = start_date_obj
            total_processed = 0

            while current_date <= end_date_obj:
                try:
                    weed_pressure_data = calculate_weed_pressure_for_location(
                        session, location_id, current_date
                    )
                    stored_count = store_weed_pressure_data(session, weed_pressure_data)
                    total_processed += stored_count

                    logger.info(
                        f"Backfilled weed pressure for location {location_id} on {current_date}: "
                        f"{stored_count} species processed",
                        extra={"request_id": request_id},
                    )

                except Exception as e:
                    logger.error(
                        f"Failed to backfill weed pressure for location {location_id} on {current_date}: {e}",
                        extra={"request_id": request_id},
                    )
                    # Continue with other dates

                current_date += timedelta(days=1)

            # TaskStatus: success
            create_or_update_task_status_sync(
                session,
                task_id,
                "backfill_weed_pressure_for_location",
                location_id,
                TaskStatusEnum.success,
                finished=True,
                request_id=request_id,
            )

            logger.info(
                f"Completed weed pressure backfill for location {location_id}: "
                f"{total_processed} total entries processed",
                extra={"request_id": request_id},
            )

    except Exception as e:
        logger.error(
            f"Weed pressure backfill failed for location {location_id}: {e}",
            extra={"request_id": request_id},
        )
        try:
            with SessionLocal() as session:
                create_or_update_task_status_sync(
                    session,
                    task_id,
                    "backfill_weed_pressure_for_location",
                    location_id,
                    TaskStatusEnum.failure,
                    error=str(e),
                    finished=True,
                    request_id=request_id,
                )
        except Exception:
            pass
        raise

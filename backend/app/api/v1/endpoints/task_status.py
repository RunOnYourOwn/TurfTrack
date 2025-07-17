from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.task_status import TaskStatus
from app.schemas.task_status import TaskStatusRead, TaskStatusList
from typing import List, Optional
from app.tasks.weather import update_weather_for_all_lawns
from fastapi.responses import JSONResponse
from datetime import datetime, timezone
from app.core.database import SessionLocal
from app.models.task_status import TaskStatusEnum
from sqlalchemy.dialects.postgresql import insert

router = APIRouter(prefix="/tasks", tags=["tasks"])

# TODO: Future enhancement: Add location/lawn/model display fields to task status API responses for better context in the Task Monitor UI.


@router.get("/", response_model=List[TaskStatusList])
async def list_tasks(
    status: Optional[str] = Query(None),
    location_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(TaskStatus)
    if status:
        query = query.where(TaskStatus.status == status)
    if location_id:
        query = query.where(TaskStatus.related_location_id == location_id)
    query = query.order_by(TaskStatus.started_at.desc()).limit(limit)
    result = await db.execute(query)
    tasks = result.scalars().all()
    return tasks


@router.get("/{task_id}", response_model=TaskStatusRead)
async def get_task(task_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TaskStatus).where(TaskStatus.task_id == task_id))
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def create_initial_task_status(
    task_id: str, task_name: str, location_id: int = None, request_id: str = None
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
            request_id=request_id,
        )
        update_dict = {
            "status": TaskStatusEnum.pending,
            "task_name": task_name,
            "related_location_id": location_id,
            "created_at": now,
            "request_id": request_id,
        }
        upsert_stmt = insert_stmt.on_conflict_do_update(
            index_elements=["task_id"],
            set_=update_dict,
        )
        session.execute(upsert_stmt)
        session.commit()


@router.post("/trigger-weather-update", tags=["tasks"])
async def trigger_weather_update(request: Request):
    request_id = getattr(request.state, "request_id", None)
    if request_id:
        task = update_weather_for_all_lawns.apply_async(
            headers={"request_id": request_id}
        )
    else:
        task = update_weather_for_all_lawns.delay()
    create_initial_task_status(
        task.id, "update_weather_for_all_lawns", request_id=request_id
    )
    return JSONResponse({"task_id": task.id, "status": "started"})

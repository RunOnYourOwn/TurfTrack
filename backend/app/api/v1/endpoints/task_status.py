from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.task_status import TaskStatus
from app.schemas.task_status import TaskStatusRead, TaskStatusList
from typing import List, Optional

router = APIRouter(prefix="/tasks", tags=["tasks"])


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

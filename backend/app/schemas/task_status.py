from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class TaskStatusRead(BaseModel):
    id: int
    task_id: str
    task_name: str
    related_location_id: Optional[int]
    related_lawn_id: Optional[int]
    status: str
    created_at: datetime
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    result: Optional[str]
    error: Optional[str]

    model_config = {"from_attributes": True}


class TaskStatusList(BaseModel):
    id: int
    task_id: str
    task_name: str
    status: str
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    result: Optional[str]
    error: Optional[str]

    model_config = {"from_attributes": True}

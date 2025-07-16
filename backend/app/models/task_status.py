import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class TaskStatusEnum(enum.Enum):
    pending = "pending"
    started = "started"
    success = "success"
    failure = "failure"


class TaskStatus(Base):
    __tablename__ = "task_status"
    id = Column(Integer, primary_key=True)
    task_id = Column(String, unique=True, nullable=False)
    task_name = Column(String, nullable=False)
    related_location_id = Column(
        Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=True
    )
    related_lawn_id = Column(
        Integer, ForeignKey("lawns.id", ondelete="CASCADE"), nullable=True
    )
    status = Column(
        Enum(TaskStatusEnum), nullable=False, default=TaskStatusEnum.pending, index=True
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True, index=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    result = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    request_id = Column(String, nullable=True)  # For correlation ID

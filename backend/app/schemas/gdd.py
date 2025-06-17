from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
import enum
from app.models.gdd import ResetType


class TempUnit(str, enum.Enum):
    C = "C"
    F = "F"


class GDDModelCreate(BaseModel):
    lawn_id: int = Field(...)
    name: str = Field(..., max_length=100)
    base_temp: float = Field(...)
    unit: TempUnit = Field(...)
    start_date: date = Field(...)
    threshold: float = Field(...)
    reset_on_threshold: bool = Field(...)


class GDDModelUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    base_temp: Optional[float] = None
    unit: Optional[TempUnit] = None
    start_date: Optional[date] = None
    threshold: Optional[float] = None
    reset_on_threshold: Optional[bool] = None


class GDDModelRead(BaseModel):
    id: int
    lawn_id: int
    name: str
    base_temp: float
    unit: TempUnit
    start_date: date
    threshold: float
    reset_on_threshold: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class GDDValueRead(BaseModel):
    id: int
    gdd_model_id: int
    date: date
    daily_gdd: float
    cumulative_gdd: float
    is_forecast: bool

    class Config:
        orm_mode = True


class GDDModelWithValues(GDDModelRead):
    gdd_values: List[GDDValueRead] = []


class GDDResetRead(BaseModel):
    id: int
    gdd_model_id: int
    reset_date: date
    run_number: int
    reset_type: ResetType
    created_at: Optional[datetime]

    class Config:
        from_attributes = True  # For Pydantic v2, replaces orm_mode

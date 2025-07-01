from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date, datetime
import enum
from app.models.gdd import ResetType


class TempUnit(str, enum.Enum):
    C = "C"
    F = "F"


class GDDModelCreate(BaseModel):
    location_id: int = Field(...)
    name: str = Field(..., max_length=100)
    base_temp: float = Field(...)
    unit: TempUnit = Field(...)
    start_date: date = Field(...)
    threshold: float = Field(...)
    reset_on_threshold: bool = Field(...)

    @field_validator("base_temp")
    def validate_base_temp(cls, v):
        if v < 0:
            raise ValueError("Base temperature cannot be negative")
        return v

    @field_validator("threshold")
    def validate_threshold(cls, v):
        if v <= 0:
            raise ValueError("Threshold must be greater than 0")
        return v


class GDDModelUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    base_temp: Optional[float] = None
    unit: Optional[TempUnit] = None
    start_date: Optional[date] = None
    threshold: Optional[float] = None
    reset_on_threshold: Optional[bool] = None

    @field_validator("base_temp")
    def validate_base_temp(cls, v):
        if v is not None and v < 0:
            raise ValueError("Base temperature cannot be negative")
        return v

    @field_validator("threshold")
    def validate_threshold(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Threshold must be greater than 0")
        return v


class GDDParameterUpdate(BaseModel):
    base_temp: Optional[float] = None
    threshold: Optional[float] = None
    reset_on_threshold: Optional[bool] = None
    recalculate_history: bool = False
    effective_from: Optional[date] = None

    @field_validator("base_temp")
    def validate_base_temp(cls, v):
        if v is not None and v < 0:
            raise ValueError("Base temperature cannot be negative")
        return v

    @field_validator("threshold")
    def validate_threshold(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Threshold must be greater than 0")
        return v


class GDDModelRead(BaseModel):
    id: int
    location_id: int
    name: str
    base_temp: float
    unit: TempUnit
    start_date: date
    threshold: float
    reset_on_threshold: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GDDParameterHistory(BaseModel):
    id: int
    gdd_model_id: int
    base_temp: float
    threshold: float
    reset_on_threshold: bool
    effective_from: date
    created_at: datetime

    class Config:
        from_attributes = True


class GDDValueRead(BaseModel):
    id: int
    gdd_model_id: int
    date: date
    daily_gdd: float
    cumulative_gdd: float
    is_forecast: bool
    effective_params: Optional[dict] = None

    class Config:
        from_attributes = True  # For Pydantic v2, replaces orm_mode


class GDDModelWithValues(GDDModelRead):
    gdd_values: List[GDDValueRead] = []


class GDDModelWithHistory(GDDModelRead):
    parameter_history: List[GDDParameterHistory] = []


class GDDResetRead(BaseModel):
    id: int
    gdd_model_id: int
    reset_date: date
    run_number: int
    reset_type: ResetType
    created_at: Optional[datetime]

    class Config:
        from_attributes = True  # For Pydantic v2, replaces orm_mode


class GDDModelDashboardRead(BaseModel):
    id: int
    location_id: int
    name: str
    base_temp: float
    unit: TempUnit
    threshold: float
    created_at: datetime
    updated_at: datetime
    current_gdd: Optional[float] = None
    last_reset: Optional[date] = None
    run_number: Optional[int] = None

    class Config:
        from_attributes = True

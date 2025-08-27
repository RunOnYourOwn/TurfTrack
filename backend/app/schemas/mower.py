from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from app.models.mower import MowerType, MaintenanceType
from .location import LocationRead


# Base schemas
class MowerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    brand: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    year: Optional[int] = Field(None, ge=1900, le=2030)
    mower_type: MowerType
    engine_hours: int = Field(..., ge=0)
    default_mowing_time_minutes: Optional[int] = Field(None, ge=1, le=480)
    notes: Optional[str] = Field(None, max_length=500)
    location_id: int
    is_active: bool = True


class MowingLogBase(BaseModel):
    mowing_date: date
    duration_minutes: int = Field(..., ge=1, le=480)
    notes: Optional[str] = Field(None, max_length=500)
    lawn_id: int


class MaintenancePartBase(BaseModel):
    part_name: str = Field(..., min_length=1, max_length=100)
    part_number: Optional[str] = Field(None, max_length=50)
    supplier: Optional[str] = Field(None, max_length=100)
    part_url: Optional[str] = Field(None, max_length=500)
    estimated_cost: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=500)


class MaintenanceScheduleBase(BaseModel):
    maintenance_type: MaintenanceType
    custom_name: Optional[str] = Field(None, max_length=100)
    interval_hours: int = Field(..., ge=1)
    interval_months: Optional[int] = Field(None, ge=1, le=120)
    notes: Optional[str] = Field(None, max_length=500)
    parts: List[MaintenancePartBase] = []


class MaintenanceLogPartBase(BaseModel):
    part_name: str = Field(..., min_length=1, max_length=100)
    part_number: Optional[str] = Field(None, max_length=50)
    quantity: int = Field(..., ge=1)
    unit_cost: Optional[float] = Field(None, ge=0)
    total_cost: Optional[float] = Field(None, ge=0)
    supplier: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)


class MaintenanceLogBase(BaseModel):
    maintenance_type: MaintenanceType
    custom_name: Optional[str] = Field(None, max_length=100)
    maintenance_date: date
    hours_at_maintenance: int = Field(..., ge=0)
    total_cost: Optional[float] = Field(None, ge=0)
    labor_cost: Optional[float] = Field(None, ge=0)
    performed_by: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)
    parts_used: List[MaintenanceLogPartBase] = []


# Create schemas
class MowerCreate(MowerBase):
    pass


class MowingLogCreate(MowingLogBase):
    pass


class MaintenancePartCreate(MaintenancePartBase):
    pass


class MaintenanceScheduleCreate(MaintenanceScheduleBase):
    pass


class MaintenanceLogPartCreate(MaintenanceLogPartBase):
    pass


class MaintenanceLogCreate(MaintenanceLogBase):
    maintenance_schedule_id: Optional[int] = None


# Read schemas
class MaintenancePartRead(MaintenancePartBase):
    id: int
    maintenance_schedule_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MaintenanceLogPartRead(MaintenanceLogPartBase):
    id: int
    maintenance_log_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class MaintenanceScheduleRead(MaintenanceScheduleBase):
    id: int
    mower_id: int
    last_maintenance_hours: int
    last_maintenance_date: Optional[date]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    parts: List[MaintenancePartRead]
    next_maintenance_hours: Optional[int]  # Calculated field
    next_maintenance_date: Optional[date]  # Calculated field
    is_due: bool  # Calculated field

    model_config = {"from_attributes": True}


class MowingLogRead(MowingLogBase):
    id: int
    mower_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MaintenanceLogRead(MaintenanceLogBase):
    id: int
    mower_id: int
    maintenance_schedule_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    parts_used: List[MaintenanceLogPartRead]

    model_config = {"from_attributes": True}


class MowerRead(MowerBase):
    id: int
    created_at: datetime
    updated_at: datetime
    location: LocationRead
    total_hours: int  # Calculated from mowing logs
    next_maintenance_due: Optional[List[dict]]  # Calculated from maintenance schedules

    model_config = {"from_attributes": True}


# Update schemas
class MowerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    brand: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    year: Optional[int] = Field(None, ge=1900, le=2030)
    mower_type: Optional[MowerType] = None
    engine_hours: Optional[int] = Field(None, ge=0)
    default_mowing_time_minutes: Optional[int] = Field(None, ge=1, le=480)
    notes: Optional[str] = Field(None, max_length=500)
    location_id: Optional[int] = None
    is_active: Optional[bool] = None


class MowingLogUpdate(BaseModel):
    mowing_date: Optional[date] = None
    duration_minutes: Optional[int] = Field(None, ge=1, le=480)
    notes: Optional[str] = Field(None, max_length=500)
    lawn_id: Optional[int] = None


class MaintenanceScheduleUpdate(BaseModel):
    maintenance_type: Optional[MaintenanceType] = None
    custom_name: Optional[str] = Field(None, max_length=100)
    interval_hours: Optional[int] = Field(None, ge=1)
    interval_months: Optional[int] = Field(None, ge=1, le=120)
    notes: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class MaintenanceLogUpdate(BaseModel):
    maintenance_type: Optional[MaintenanceType] = None
    custom_name: Optional[str] = Field(None, max_length=100)
    maintenance_date: Optional[date] = None
    hours_at_maintenance: Optional[int] = Field(None, ge=0)
    total_cost: Optional[float] = Field(None, ge=0)
    labor_cost: Optional[float] = Field(None, ge=0)
    performed_by: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)


# Specialized schemas
class MaintenanceDueItem(BaseModel):
    mower_id: int
    mower_name: str
    maintenance_schedule_id: int
    maintenance_type: MaintenanceType
    custom_name: Optional[str]
    last_maintenance_hours: int
    current_hours: int
    hours_overdue: int
    last_maintenance_date: Optional[date]
    next_maintenance_date: Optional[date]
    is_overdue: bool

    model_config = {"from_attributes": True}


class MowerSummary(BaseModel):
    id: int
    name: str
    brand: Optional[str]
    model: Optional[str]
    mower_type: MowerType
    total_hours: int
    maintenance_due_count: int
    is_active: bool
    location: LocationRead

    model_config = {"from_attributes": True}

from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
import enum


class ApplicationStatus(str, enum.Enum):
    planned = "planned"
    completed = "completed"
    skipped = "skipped"


class ApplicationUnit(str, enum.Enum):
    lbs = "lbs"
    oz = "oz"
    kg = "kg"
    g = "g"
    gal = "gal"
    qt = "qt"
    pt = "pt"
    fl_oz = "fl_oz"
    L = "L"
    mL = "mL"
    bags = "bags"
    tablets = "tablets"


class ApplicationBase(BaseModel):
    lawn_id: int
    product_id: int
    application_date: date
    amount_per_area: float
    area_unit: int = 1000
    unit: ApplicationUnit
    notes: Optional[str] = None
    status: ApplicationStatus = ApplicationStatus.planned
    tied_gdd_model_id: Optional[int] = None


class ApplicationCreate(ApplicationBase):
    lawn_ids: Optional[List[int]] = None  # For batch apply


class ApplicationUpdate(BaseModel):
    application_date: Optional[date] = None
    amount_per_area: Optional[float] = None
    area_unit: Optional[int] = None
    unit: Optional[ApplicationUnit] = None
    notes: Optional[str] = None
    status: Optional[ApplicationStatus] = None
    tied_gdd_model_id: Optional[int] = None


class ApplicationRead(ApplicationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

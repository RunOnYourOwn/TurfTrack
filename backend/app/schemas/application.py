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
    lawn_id: Optional[int] = None  # Make this optional!


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
    n_applied: Optional[float] = None
    p_applied: Optional[float] = None
    k_applied: Optional[float] = None
    ca_applied: Optional[float] = None
    mg_applied: Optional[float] = None
    s_applied: Optional[float] = None
    fe_applied: Optional[float] = None
    cu_applied: Optional[float] = None
    mn_applied: Optional[float] = None
    b_applied: Optional[float] = None
    zn_applied: Optional[float] = None
    cost_applied: Optional[float] = None

    model_config = {"from_attributes": True}

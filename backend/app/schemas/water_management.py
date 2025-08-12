from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime, date
from app.models.water_management import IrrigationSource


class IrrigationEntryBase(BaseModel):
    date: date
    amount: float = Field(..., gt=0, description="Amount in inches")
    duration: int = Field(..., ge=0, description="Duration in minutes")
    source: IrrigationSource = IrrigationSource.MANUAL
    notes: Optional[str] = Field(None, max_length=500)


class IrrigationEntryCreate(IrrigationEntryBase):
    lawn_id: int


class IrrigationEntryUpdate(BaseModel):
    date: Optional[str] = None  # Accept string and convert to date
    amount: Optional[float] = Field(None, ge=0)
    duration: Optional[int] = Field(None, ge=0)
    source: Optional[IrrigationSource] = None
    notes: Optional[str] = Field(None, max_length=500)

    @field_validator("date")
    @classmethod
    def validate_date(cls, v):
        if v is None:
            return None
        try:
            return datetime.strptime(v, "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("Invalid date format. Use YYYY-MM-DD")


class IrrigationEntryRead(IrrigationEntryBase):
    id: int
    lawn_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WeeklyWaterSummary(BaseModel):
    week_start: date
    week_end: date
    et0_total: float
    precipitation_total: float
    irrigation_applied: float
    water_deficit: float
    status: str
    is_forecast: bool = False

    model_config = {"from_attributes": True}


class WaterManagementSummary(BaseModel):
    lawn_id: int
    current_week: Optional[WeeklyWaterSummary] = None
    weekly_data: List[WeeklyWaterSummary] = []
    total_monthly_water: float

    model_config = {"from_attributes": True}

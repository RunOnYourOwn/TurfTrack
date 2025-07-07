from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class GrowthPotentialRead(BaseModel):
    id: int
    date: date
    location_id: int
    growth_potential: Optional[float] = None
    gp_3d_avg: Optional[float] = None
    gp_5d_avg: Optional[float] = None
    gp_7d_avg: Optional[float] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GrowthPotentialList(BaseModel):
    id: int
    date: date
    location_id: int
    growth_potential: Optional[float] = None
    gp_3d_avg: Optional[float] = None
    gp_5d_avg: Optional[float] = None
    gp_7d_avg: Optional[float] = None

    class Config:
        from_attributes = True


class GrowthPotentialWithForecast(GrowthPotentialRead):
    is_forecast: bool

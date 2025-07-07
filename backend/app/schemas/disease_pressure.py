from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class DiseasePressureRead(BaseModel):
    id: int
    date: date
    location_id: int
    disease: str
    risk_score: Optional[float] = None
    created_at: Optional[datetime] = None
    is_forecast: Optional[bool] = None

    class Config:
        from_attributes = True


class DiseasePressureList(BaseModel):
    id: int
    date: date
    location_id: int
    disease: str
    risk_score: Optional[float] = None
    is_forecast: Optional[bool] = None

    class Config:
        from_attributes = True

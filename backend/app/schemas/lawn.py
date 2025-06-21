from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from datetime import datetime
from app.models.lawn import GrassType, WeatherFetchFrequency
from .location import LocationRead


class LawnBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    area: float
    grass_type: GrassType
    notes: Optional[str] = Field(None, max_length=500)
    weather_fetch_frequency: WeatherFetchFrequency
    timezone: str
    weather_enabled: bool = True


class LawnCreate(LawnBase):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

    @field_validator("area")
    def area_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Area must be greater than 0")
        return v


class LawnRead(LawnBase):
    id: int
    created_at: datetime
    updated_at: datetime
    location: LocationRead

    model_config = {"from_attributes": True}


class LawnUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    area: Optional[float] = Field(None)
    grass_type: Optional[GrassType] = None
    notes: Optional[str] = Field(None, max_length=500)
    weather_fetch_frequency: Optional[WeatherFetchFrequency] = None
    timezone: Optional[str] = None
    weather_enabled: Optional[bool] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)

    @field_validator("area")
    def area_must_be_positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Area must be greater than 0")
        return v

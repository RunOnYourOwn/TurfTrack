from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class LawnCreate(BaseModel):
    name: str = Field(..., description="Lawn name", example="Front Yard")
    area: float = Field(..., description="Lawn area in square feet", example=1200)
    grass_type: Literal["cold_season", "warm_season"] = Field(
        ..., description="Grass type"
    )
    location: str = Field(
        ...,
        description="Lawn address (used for weather lookup)",
        example="123 Main St, Springfield, IL",
    )
    notes: Optional[str] = Field(None, description="Additional notes")
    weather_fetch_frequency: Literal["4h", "8h", "12h", "24h"] = Field(
        "24h", description="How often to fetch weather data (default: 24h)"
    )
    timezone: str = Field(..., description="IANA timezone, e.g. America/Chicago")
    weather_enabled: bool = Field(True, description="Enable weather data fetching")


class LawnRead(BaseModel):
    id: int = Field(...)
    name: str = Field(...)
    area: float = Field(...)
    grass_type: str = Field(...)
    location: str = Field(..., description="Lawn address (used for weather lookup)")
    notes: Optional[str] = Field(None)
    weather_fetch_frequency: str = Field(...)
    timezone: str = Field(...)
    weather_enabled: bool = Field(...)
    created_at: datetime = Field(...)
    updated_at: datetime = Field(...)

    model_config = {"from_attributes": True}


class LawnUpdate(BaseModel):
    name: Optional[str] = Field(None)
    area: Optional[float] = Field(None)
    grass_type: Optional[Literal["cold_season", "warm_season"]] = Field(None)
    location: Optional[str] = Field(
        None, description="Lawn address (used for weather lookup)"
    )
    notes: Optional[str] = Field(None)
    weather_fetch_frequency: Optional[Literal["4h", "8h", "12h", "24h"]] = Field(None)
    timezone: Optional[str] = Field(None)
    weather_enabled: Optional[bool] = Field(None)

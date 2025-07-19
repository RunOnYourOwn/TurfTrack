from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date as date_type, datetime
from enum import Enum


class WeedSeason(str, Enum):
    spring = "spring"
    summer = "summer"
    fall = "fall"
    year_round = "year_round"


class MoisturePreference(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class WeedSpeciesBase(BaseModel):
    name: str = Field(..., description="Scientific name of the weed species")
    common_name: str = Field(..., description="Common name of the weed species")
    gdd_base_temp_c: float = Field(
        ..., description="Base temperature for GDD calculation"
    )
    gdd_threshold_emergence: float = Field(
        ..., description="GDD threshold for emergence"
    )
    optimal_soil_temp_min_c: float = Field(
        ..., description="Minimum optimal soil temperature"
    )
    optimal_soil_temp_max_c: float = Field(
        ..., description="Maximum optimal soil temperature"
    )
    moisture_preference: MoisturePreference = Field(
        ..., description="Moisture preference"
    )
    season: WeedSeason = Field(..., description="Primary growing season")
    is_active: bool = Field(True, description="Whether the species is active")


class WeedSpeciesCreate(WeedSpeciesBase):
    pass


class WeedSpeciesUpdate(BaseModel):
    name: Optional[str] = None
    common_name: Optional[str] = None
    gdd_base_temp_c: Optional[float] = None
    gdd_threshold_emergence: Optional[float] = None
    optimal_soil_temp_min_c: Optional[float] = None
    optimal_soil_temp_max_c: Optional[float] = None
    moisture_preference: Optional[MoisturePreference] = None
    season: Optional[WeedSeason] = None
    is_active: Optional[bool] = None


class WeedSpecies(WeedSpeciesBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WeedPressureBase(BaseModel):
    location_id: int = Field(..., description="Location ID")
    date: date_type = Field(..., description="Date of the weed pressure calculation")
    weed_species_id: int = Field(..., description="Weed species ID")
    weed_pressure_score: float = Field(
        ..., description="Overall weed pressure score (0-10)"
    )
    gdd_risk_score: float = Field(..., description="GDD-based risk score (0-3)")
    soil_temp_risk_score: float = Field(
        ..., description="Soil temperature risk score (0-2)"
    )
    moisture_risk_score: float = Field(..., description="Moisture risk score (0-2)")
    turf_stress_score: float = Field(..., description="Turf stress score (0-2)")
    seasonal_timing_score: float = Field(..., description="Seasonal timing score (0-1)")
    gdd_accumulated: float = Field(..., description="Accumulated GDD for the species")
    soil_temp_estimate_c: float = Field(..., description="Estimated soil temperature")
    precipitation_3day_mm: float = Field(..., description="3-day precipitation total")
    humidity_avg: float = Field(..., description="Average humidity")
    et0_mm: float = Field(..., description="Evapotranspiration")
    is_forecast: bool = Field(False, description="Whether this is forecast data")


class WeedPressureCreate(WeedPressureBase):
    pass


class WeedPressure(WeedPressureBase):
    id: int
    created_at: datetime
    weed_species: WeedSpecies

    class Config:
        from_attributes = True


class WeedPressureChartDataPoint(BaseModel):
    date: date_type
    pressure_score: float
    gdd_accumulated: float
    is_forecast: bool = False


class WeedPressureChartSpecies(BaseModel):
    species_id: int
    species_name: str
    common_name: str
    data_points: List[WeedPressureChartDataPoint]


class DateRange(BaseModel):
    start_date: date_type
    end_date: date_type


class CurrentStatus(BaseModel):
    highest_pressure: float
    status: str
    recommendations: List[str]


class WeedPressureChartResponse(BaseModel):
    location_id: int
    date_range: DateRange
    species_data: List[WeedPressureChartSpecies]
    current_status: CurrentStatus


class WeedPressureStatus(BaseModel):
    highest_pressure: float
    highest_species: str
    status: str
    recommendations: List[str]


class WeedPressureChartRequest(BaseModel):
    start_date: date_type
    end_date: date_type
    species_ids: Optional[List[int]] = None
    include_forecast: bool = True


class WeedPressureChartFlatResponse(BaseModel):
    """Flat response for weed pressure chart data (similar to growth potential)"""

    date: date_type
    species_id: int
    species_name: str
    common_name: str
    pressure_score: float
    gdd_accumulated: Optional[float] = None
    is_forecast: bool

    class Config:
        from_attributes = True

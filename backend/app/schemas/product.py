from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class ProductBase(BaseModel):
    name: str
    n_pct: Optional[float] = 0.0
    p_pct: Optional[float] = 0.0
    k_pct: Optional[float] = 0.0
    ca_pct: Optional[float] = 0.0
    mg_pct: Optional[float] = 0.0
    s_pct: Optional[float] = 0.0
    fe_pct: Optional[float] = 0.0
    cu_pct: Optional[float] = 0.0
    mn_pct: Optional[float] = 0.0
    b_pct: Optional[float] = 0.0
    zn_pct: Optional[float] = 0.0
    weight_lbs: Optional[float] = None
    cost_per_bag: Optional[float] = None
    sgn: Optional[str] = None
    product_link: Optional[str] = None
    label: Optional[str] = None
    sources: Optional[str] = None
    urea_nitrogen: Optional[float] = None
    ammoniacal_nitrogen: Optional[float] = None
    water_insol_nitrogen: Optional[float] = None
    other_water_soluble: Optional[float] = None
    slowly_available_from: Optional[str] = None
    last_scraped_price: Optional[float] = None
    last_scraped_at: Optional[datetime] = None

    @field_validator(
        "n_pct",
        "p_pct",
        "k_pct",
        "ca_pct",
        "mg_pct",
        "s_pct",
        "fe_pct",
        "cu_pct",
        "mn_pct",
        "b_pct",
        "zn_pct",
    )
    def validate_percentages(cls, v):
        if v is not None and not 0 <= v <= 100:
            raise ValueError("Nutrient percentages must be between 0 and 100")
        return v

    @field_validator("weight_lbs", "cost_per_bag")
    def validate_positive_numbers(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Weight and cost must be positive numbers")
        return v


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    n_pct: Optional[float] = None
    p_pct: Optional[float] = None
    k_pct: Optional[float] = None
    ca_pct: Optional[float] = None
    mg_pct: Optional[float] = None
    s_pct: Optional[float] = None
    fe_pct: Optional[float] = None
    cu_pct: Optional[float] = None
    mn_pct: Optional[float] = None
    b_pct: Optional[float] = None
    zn_pct: Optional[float] = None
    weight_lbs: Optional[float] = None
    cost_per_bag: Optional[float] = None
    sgn: Optional[str] = None
    product_link: Optional[str] = None
    label: Optional[str] = None
    sources: Optional[str] = None
    urea_nitrogen: Optional[float] = None
    ammoniacal_nitrogen: Optional[float] = None
    water_insol_nitrogen: Optional[float] = None
    other_water_soluble: Optional[float] = None
    slowly_available_from: Optional[str] = None
    last_scraped_price: Optional[float] = None
    last_scraped_at: Optional[datetime] = None

    @field_validator(
        "n_pct",
        "p_pct",
        "k_pct",
        "ca_pct",
        "mg_pct",
        "s_pct",
        "fe_pct",
        "cu_pct",
        "mn_pct",
        "b_pct",
        "zn_pct",
    )
    def validate_percentages(cls, v):
        if v is not None and not 0 <= v <= 100:
            raise ValueError("Nutrient percentages must be between 0 and 100")
        return v

    @field_validator("weight_lbs", "cost_per_bag")
    def validate_positive_numbers(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Weight and cost must be positive numbers")
        return v


class ProductRead(ProductBase):
    id: int
    cost_per_lb_n: Optional[float] = None
    cost_per_lb: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

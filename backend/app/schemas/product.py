from pydantic import BaseModel
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


class ProductCreate(ProductBase):
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


class ProductRead(ProductBase):
    id: int
    cost_per_lb_n: Optional[float] = None
    cost_per_lb: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

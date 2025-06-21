from pydantic import BaseModel
from typing import Optional


class LocationBase(BaseModel):
    latitude: float
    longitude: float
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None


class LocationRead(LocationBase):
    id: int

    model_config = {"from_attributes": True}

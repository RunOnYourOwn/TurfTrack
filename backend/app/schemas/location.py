from pydantic import BaseModel


class LocationBase(BaseModel):
    name: str
    latitude: float
    longitude: float


class LocationCreate(LocationBase):
    pass


class LocationRead(LocationBase):
    id: int

    model_config = {"from_attributes": True}

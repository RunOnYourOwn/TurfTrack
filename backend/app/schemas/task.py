from typing import Optional
from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    title: str = Field(
        ...,
        description="The title of the task",
        example="Complete project documentation",
    )
    description: str = Field(
        ...,
        description="A detailed description of the task",
        example="Write API documentation and update README",
    )


class TaskRead(BaseModel):
    id: int = Field(..., description="The unique identifier of the task", example=1)
    title: str = Field(
        ...,
        description="The title of the task",
        example="Complete project documentation",
    )
    description: str = Field(
        ...,
        description="A detailed description of the task",
        example="Write API documentation and update README",
    )

    model_config = {"from_attributes": True}


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(
        None,
        description="The new title of the task",
        example="Updated project documentation",
    )
    description: Optional[str] = Field(
        None,
        description="The new description of the task",
        example="Add more details to the documentation",
    )

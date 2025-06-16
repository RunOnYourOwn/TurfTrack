from fastapi import APIRouter
from app.api.v1.endpoints import lawn, task_status

api_router = APIRouter()
api_router.include_router(lawn.router)
api_router.include_router(task_status.router)

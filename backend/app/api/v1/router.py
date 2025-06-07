from fastapi import APIRouter
from app.api.v1.endpoints.lawn import router as lawn_router

api_router = APIRouter()
api_router.include_router(lawn_router)

from fastapi import APIRouter
from app.api.v1.endpoints import lawn, task_status, gdd, product, application

api_router = APIRouter()
api_router.include_router(lawn.router)
api_router.include_router(task_status.router)
api_router.include_router(gdd.router)
api_router.include_router(product.router)
api_router.include_router(application.router)

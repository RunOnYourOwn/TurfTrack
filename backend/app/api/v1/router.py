from fastapi import APIRouter
from .endpoints.lawn import router as lawn_router
from .endpoints.product import router as product_router
from .endpoints.application import router as application_router
from .endpoints.gdd import router as gdd_router
from .endpoints.task_status import router as task_status_router
from .endpoints.version import router as version_router
from .endpoints.weather import router as weather_router
from .endpoints.location import router as location_router
from .endpoints.disease_pressure import router as disease_pressure_router
from .endpoints.growth_potential import router as growth_potential_router

api_router = APIRouter()
api_router.include_router(lawn_router)
api_router.include_router(product_router)
api_router.include_router(application_router)
api_router.include_router(gdd_router)
api_router.include_router(task_status_router)
api_router.include_router(version_router)
api_router.include_router(weather_router)
api_router.include_router(location_router)
api_router.include_router(disease_pressure_router)
api_router.include_router(growth_potential_router)

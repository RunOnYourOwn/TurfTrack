from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from redis.asyncio import Redis
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.redis import get_redis
from app.core.logging import configure_logging
from app.core.health import check_database, check_redis, check_celery
import logging
from datetime import datetime

configure_logging()

app = FastAPI(
    title=settings.APP_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    debug=settings.DEBUG,
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Print all registered routes for debugging
for route in app.routes:
    print(f"Route: {route.path}, Methods: {route.methods}")


@app.get("/health")
async def health_check(
    redis: Redis = Depends(get_redis),
) -> dict:
    """
    Basic health check endpoint that verifies the service is running.
    Returns 200 if the service is up, regardless of dependency status.
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "service": "TurfTrack API",
        "checks": {},
    }

    # Check Redis
    health_status["checks"]["redis"] = await check_redis(redis)

    # Check Database
    health_status["checks"]["database"] = await check_database()

    # Check Celery (uses Redis)
    health_status["checks"]["celery"] = await check_celery(redis)

    return health_status


@app.get("/ready")
async def readiness_check(
    redis: Redis = Depends(get_redis),
) -> dict:
    """
    Readiness check endpoint for load balancers.
    Returns 200 only if all critical dependencies are healthy.
    """
    readiness_status = {
        "status": "ready",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "service": "TurfTrack API",
        "checks": {},
    }

    # Check all dependencies
    db_check = await check_database()
    redis_check = await check_redis(redis)
    celery_check = await check_celery(redis)

    readiness_status["checks"]["database"] = db_check
    readiness_status["checks"]["redis"] = redis_check
    readiness_status["checks"]["celery"] = celery_check

    # Determine overall readiness
    all_healthy = all(
        check["status"] == "healthy" for check in [db_check, redis_check, celery_check]
    )

    if not all_healthy:
        readiness_status["status"] = "not_ready"
        # Return 503 Service Unavailable for load balancers
        raise HTTPException(
            status_code=503,
            detail="Service not ready - one or more dependencies are unhealthy",
        )

    return readiness_status


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logging.error(f"HTTPException: {exc.detail}", exc_info=exc)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logging.error(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logging.error(f"Unhandled error: {str(exc)}", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


def main():
    print("Hello from backend!")


if __name__ == "__main__":
    main()

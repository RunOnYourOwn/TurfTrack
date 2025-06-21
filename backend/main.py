from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from redis.asyncio import Redis
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.redis import get_redis
from app.core.logging import configure_logging
from app.core.logging_config import get_logger, log_exception
from app.middleware.logging import LoggingMiddleware
from app.core.health import check_database, check_redis, check_celery
from datetime import datetime

# Configure logging first
configure_logging()
logger = get_logger("main")

app = FastAPI(
    title=settings.APP_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    debug=settings.DEBUG,
)

# Add logging middleware first (before CORS)
app.add_middleware(LoggingMiddleware)

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
logger.info("Application starting up")
for route in app.routes:
    logger.debug(f"Route: {route.path}, Methods: {route.methods}")


@app.get("/health")
async def health_check(
    redis: Redis = Depends(get_redis),
) -> dict:
    """
    Basic health check endpoint that verifies the service is running.
    Returns 200 if the service is up, regardless of dependency status.
    """
    logger.debug("Health check requested")

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

    logger.debug("Health check completed", extra={"health_status": health_status})
    return health_status


@app.get("/ready")
async def readiness_check(
    redis: Redis = Depends(get_redis),
) -> dict:
    """
    Readiness check endpoint for load balancers.
    Returns 200 only if all critical dependencies are healthy.
    """
    logger.debug("Readiness check requested")

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
        logger.warning(
            "Service not ready - dependencies unhealthy",
            extra={"checks": readiness_status["checks"]},
        )
        # Return 503 Service Unavailable for load balancers
        raise HTTPException(
            status_code=503,
            detail="Service not ready - one or more dependencies are unhealthy",
        )

    logger.debug("Readiness check completed - service ready")
    return readiness_status


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", "unknown")
    log_exception(request_id=request_id, exc=exc, handler="http_exception")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(
        "Validation error",
        extra={
            "request_id": request_id,
            "validation_errors": exc.errors(),
            "handler": "validation_exception",
        },
    )
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    log_exception(request_id=request_id, exc=exc, handler="unhandled_exception")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


def main():
    logger.info("Hello from backend!")


if __name__ == "__main__":
    main()

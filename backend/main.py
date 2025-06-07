from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from redis.asyncio import Redis
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.redis import get_redis
from app.core.logging import configure_logging
import logging

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
    Health check endpoint that verifies Redis connections.
    """
    health_status = {
        "status": "ok",
        "redis": "unavailable",
    }

    try:
        # Test Redis connection
        await redis.ping()
        health_status["redis"] = "ok"
    except Exception as e:
        health_status["status"] = "error"
        health_status["redis_error"] = str(e)

    return health_status


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

import time
from typing import Dict, Any
from sqlalchemy import text
from redis.asyncio import Redis
import redis.exceptions
from app.core.database import async_session_maker


async def check_database() -> Dict[str, Any]:
    """Check database connectivity and return status with response time."""
    start_time = time.time()
    try:
        async with async_session_maker() as session:
            # Execute a simple query to test connectivity
            result = await session.execute(text("SELECT 1"))
            result.fetchone()

        response_time = round((time.time() - start_time) * 1000, 2)
        return {"status": "healthy", "response_time_ms": response_time}
    except Exception as e:
        response_time = round((time.time() - start_time) * 1000, 2)
        return {
            "status": "unhealthy",
            "response_time_ms": response_time,
            "error": str(e),
        }


async def check_redis(redis_client: Redis) -> Dict[str, Any]:
    """Check Redis connectivity and return status with response time."""
    start_time = time.time()
    try:
        await redis_client.ping()
        response_time = round((time.time() - start_time) * 1000, 2)
        return {"status": "healthy", "response_time_ms": response_time}
    except redis.exceptions.ConnectionError as e:
        response_time = round((time.time() - start_time) * 1000, 2)
        return {
            "status": "unhealthy",
            "response_time_ms": response_time,
            "error": str(e),
        }


async def check_celery(redis_client: Redis) -> Dict[str, Any]:
    """Check Celery broker (Redis) connectivity and return status with response time."""
    start_time = time.time()
    try:
        # Test if we can access the Celery broker
        await redis_client.ping()
        response_time = round((time.time() - start_time) * 1000, 2)
        return {"status": "healthy", "response_time_ms": response_time}
    except redis.exceptions.ConnectionError as e:
        response_time = round((time.time() - start_time) * 1000, 2)
        return {
            "status": "unhealthy",
            "response_time_ms": response_time,
            "error": str(e),
        }

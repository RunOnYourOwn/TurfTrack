from typing import AsyncGenerator
from redis.asyncio import Redis, ConnectionPool
from app.core.config import settings

# Create a connection pool
pool = ConnectionPool.from_url(
    settings.REDIS_URL,
    max_connections=10,
    decode_responses=True,  # Automatically decode responses to Python strings
)


async def get_redis() -> AsyncGenerator[Redis, None]:
    """
    FastAPI dependency for getting Redis connections.
    Usage:
        @app.get("/items")
        async def get_items(redis: Redis = Depends(get_redis)):
            ...
    """
    client = Redis(connection_pool=pool)
    try:
        yield client
    finally:
        await client.close()

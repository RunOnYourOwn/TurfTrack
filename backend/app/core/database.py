from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings
from app.core.logging_config import log_performance_metric
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker as sync_sessionmaker
import time

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
)

# Create async session factory
async_session_maker = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Create sync engine for Celery tasks
sync_database_url = settings.DATABASE_URL.replace("+asyncpg", "")
sync_engine = create_engine(
    sync_database_url,
    echo=False,
    future=True,
)

SessionLocal = sync_sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=sync_engine,
)


class Base(DeclarativeBase):
    """Base class for all database models."""

    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency for getting database sessions.
    Usage:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    start_time = time.time()
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()
            duration_ms = (time.time() - start_time) * 1000
            log_performance_metric(
                "database_session", duration_ms, success=True, session_type="async"
            )

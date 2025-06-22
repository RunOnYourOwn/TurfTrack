"""
Pytest configuration and fixtures for TurfTrack backend tests.
"""

import asyncio
import os
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.database import get_db, Base
from main import app

# Test database configuration
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://test_user:test_password@localhost:5433/turftrack_test",
)

# Test Redis configuration
TEST_REDIS_URL = os.getenv("TEST_REDIS_URL", "redis://localhost:6380/1")


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_db_setup():
    """Set up test database tables."""
    # Create a temporary engine for setup
    temp_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with temp_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await temp_engine.dispose()
    yield
    # Cleanup
    temp_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with temp_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await temp_engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_db_setup) -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database session for each test."""
    # Create a fresh engine for each test
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        yield session
        await session.rollback()

    await engine.dispose()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Create a test client with database dependency override."""

    def override_get_db():
        """Override the database dependency for testing."""
        # This is a sync generator that yields None
        # The actual async session will be handled by the test
        yield None

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def mock_redis():
    """Mock Redis client for testing."""
    mock_redis = MagicMock()
    mock_redis.ping.return_value = True
    mock_redis.get.return_value = None
    mock_redis.set.return_value = True
    mock_redis.delete.return_value = 1
    return mock_redis


@pytest.fixture
def mock_celery():
    """Mock Celery app for testing."""
    mock_celery = MagicMock()
    mock_celery.send_task = AsyncMock()
    mock_celery.control.inspect.return_value = MagicMock()
    return mock_celery


@pytest.fixture
def mock_weather_api():
    """Mock weather API responses."""
    return {
        "daily": {
            "time": ["2024-01-01", "2024-01-02", "2024-01-03"],
            "temperature_2m_max": [25.0, 26.0, 24.0],
            "temperature_2m_min": [15.0, 16.0, 14.0],
            "precipitation_sum": [0.0, 5.0, 0.0],
        },
        "daily_units": {
            "temperature_2m_max": "°C",
            "temperature_2m_min": "°C",
            "precipitation_sum": "mm",
        },
    }


@pytest.fixture
def sample_lawn_data():
    """Sample lawn data for testing."""
    return {
        "name": "Test Lawn",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "area_sqft": 5000.0,
        "grass_type": "Kentucky Bluegrass",
    }


@pytest.fixture
def sample_product_data():
    """Sample product data for testing."""
    return {
        "name": "Test Fertilizer",
        "n_pct": 20.0,
        "p_pct": 10.0,
        "k_pct": 10.0,
        "cost_per_bag": 10.0,
        "weight_lbs": 4.0,
    }


@pytest.fixture
def sample_gdd_model_data():
    """Sample GDD model data for testing."""
    return {
        "name": "Test GDD Model",
        "base_temp": 10.0,
        "unit": "C",
        "start_date": "2024-01-01",
        "threshold": 1000.0,
    }


# Test markers for easy filtering
pytest_plugins = ["pytest_asyncio"]

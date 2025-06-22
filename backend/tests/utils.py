"""
Test utilities for TurfTrack backend tests.
"""

import random
from datetime import date, timedelta
from typing import Dict, Any
from unittest.mock import MagicMock

import factory
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lawn import Lawn
from app.models.product import Product
from app.models.gdd import GDDModel
from app.models.application import Application
from app.models.location import Location
from app.models.daily_weather import DailyWeather


class LawnFactory(factory.Factory):
    """Factory for creating test Lawn instances."""

    class Meta:
        model = Lawn

    name = factory.Sequence(lambda n: f"Test Lawn {n}")
    latitude = factory.LazyFunction(lambda: random.uniform(30.0, 50.0))
    longitude = factory.LazyFunction(lambda: random.uniform(-120.0, -70.0))
    area_sqft = factory.LazyFunction(lambda: random.uniform(1000.0, 10000.0))
    grass_type = factory.Iterator(
        ["Kentucky Bluegrass", "Perennial Ryegrass", "Tall Fescue"]
    )


class ProductFactory(factory.Factory):
    """Factory for creating test Product instances."""

    class Meta:
        model = Product

    name = factory.Sequence(lambda n: f"Test Product {n}")
    n_percent = factory.LazyFunction(lambda: random.uniform(10.0, 30.0))
    p_percent = factory.LazyFunction(lambda: random.uniform(5.0, 20.0))
    k_percent = factory.LazyFunction(lambda: random.uniform(5.0, 20.0))
    cost_per_lb = factory.LazyFunction(lambda: random.uniform(1.0, 5.0))
    application_rate_lbs_per_1000_sqft = factory.LazyFunction(
        lambda: random.uniform(2.0, 8.0)
    )


class GDDModelFactory(factory.Factory):
    """Factory for creating test GDDModel instances."""

    class Meta:
        model = GDDModel

    name = factory.Sequence(lambda n: f"Test GDD Model {n}")
    base_temp_c = factory.LazyFunction(lambda: random.uniform(5.0, 15.0))
    units = factory.Iterator(["C", "F"])
    start_date = factory.LazyFunction(lambda: date.today() - timedelta(days=30))
    threshold_reset = factory.LazyFunction(lambda: random.uniform(500.0, 1500.0))


class LocationFactory(factory.Factory):
    """Factory for creating test Location instances."""

    class Meta:
        model = Location

    name = factory.Sequence(lambda n: f"Test Location {n}")
    latitude = factory.LazyFunction(lambda: random.uniform(30.0, 50.0))
    longitude = factory.LazyFunction(lambda: random.uniform(-120.0, -70.0))
    elevation_m = factory.LazyFunction(lambda: random.uniform(0.0, 2000.0))


class DailyWeatherFactory(factory.Factory):
    """Factory for creating test DailyWeather instances."""

    class Meta:
        model = DailyWeather

    location_id = factory.LazyFunction(lambda: random.randint(1, 100))
    date = factory.LazyFunction(
        lambda: date.today() - timedelta(days=random.randint(1, 30))
    )
    temp_max_c = factory.LazyFunction(lambda: random.uniform(15.0, 35.0))
    temp_min_c = factory.LazyFunction(lambda: random.uniform(5.0, 25.0))
    precipitation_mm = factory.LazyFunction(lambda: random.uniform(0.0, 50.0))


class ApplicationFactory(factory.Factory):
    """Factory for creating test Application instances."""

    class Meta:
        model = Application

    lawn_id = factory.LazyFunction(lambda: random.randint(1, 100))
    product_id = factory.LazyFunction(lambda: random.randint(1, 100))
    application_date = factory.LazyFunction(
        lambda: date.today() - timedelta(days=random.randint(1, 30))
    )
    rate_applied_lbs_per_1000_sqft = factory.LazyFunction(
        lambda: random.uniform(2.0, 8.0)
    )
    total_cost = factory.LazyFunction(lambda: random.uniform(10.0, 100.0))


async def create_test_lawn(db: AsyncSession, **kwargs) -> Lawn:
    """Create and save a test lawn to the database."""
    lawn_data = LawnFactory.build(**kwargs)
    lawn = Lawn(**lawn_data.__dict__)
    db.add(lawn)
    await db.commit()
    await db.refresh(lawn)
    return lawn


async def create_test_product(db: AsyncSession, **kwargs) -> Product:
    """Create and save a test product to the database."""
    product_data = ProductFactory.build(**kwargs)
    product = Product(**product_data.__dict__)
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


async def create_test_gdd_model(db: AsyncSession, **kwargs) -> GDDModel:
    """Create and save a test GDD model to the database."""
    model_data = GDDModelFactory.build(**kwargs)
    model = GDDModel(**model_data.__dict__)
    db.add(model)
    await db.commit()
    await db.refresh(model)
    return model


def assert_api_response_structure(response_data: Dict[str, Any], expected_fields: list):
    """Assert that API response has the expected structure."""
    for field in expected_fields:
        assert field in response_data, f"Missing field: {field}"


def assert_error_response(response, status_code: int, error_type: str = None):
    """Assert that response is an error with expected status code."""
    assert response.status_code == status_code
    if error_type:
        assert "detail" in response.json()
        if isinstance(response.json()["detail"], dict):
            assert "type" in response.json()["detail"]
            assert response.json()["detail"]["type"] == error_type


def create_mock_weather_data(
    start_date: date = None,
    days: int = 7,
    temp_range: tuple = (15.0, 30.0),
    precip_range: tuple = (0.0, 20.0),
) -> Dict[str, Any]:
    """Create mock weather data for testing."""
    if start_date is None:
        start_date = date.today() - timedelta(days=days)

    dates = [start_date + timedelta(days=i) for i in range(days)]

    return {
        "daily": {
            "time": [d.isoformat() for d in dates],
            "temperature_2m_max": [random.uniform(*temp_range) for _ in range(days)],
            "temperature_2m_min": [
                random.uniform(temp_range[0] - 10, temp_range[1] - 10)
                for _ in range(days)
            ],
            "precipitation_sum": [random.uniform(*precip_range) for _ in range(days)],
        },
        "daily_units": {
            "temperature_2m_max": "°C",
            "temperature_2m_min": "°C",
            "precipitation_sum": "mm",
        },
    }


def mock_celery_task_result(result_value: Any = None, task_id: str = "test-task-id"):
    """Create a mock Celery task result."""
    mock_result = MagicMock()
    mock_result.id = task_id
    mock_result.get.return_value = result_value
    mock_result.status = "SUCCESS"
    return mock_result

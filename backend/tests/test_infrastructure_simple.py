"""
Simple tests to verify test infrastructure is working correctly without database.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.mark.unit
def test_app_import():
    """Test that the app can be imported."""
    assert app is not None


@pytest.mark.unit
def test_app_title():
    """Test that the app has the correct title."""
    assert app.title == "TurfTrack"


@pytest.mark.unit
def test_app_has_routes():
    """Test that the app has routes configured."""
    assert len(app.routes) > 0


@pytest.mark.unit
def test_app_middleware():
    """Test that CORS middleware is configured."""
    assert any(
        "CORSMiddleware" in str(middleware) for middleware in app.user_middleware
    )


@pytest.mark.unit
def test_mock_fixtures_work(mock_redis, mock_celery):
    """Test that mock fixtures work."""
    assert mock_redis is not None
    assert mock_celery is not None
    assert mock_redis.ping() is True
    assert mock_celery.send_task is not None


@pytest.mark.unit
def test_sample_data_fixtures(
    sample_lawn_data, sample_product_data, sample_gdd_model_data
):
    """Test that sample data fixtures work."""
    assert sample_lawn_data["name"] == "Test Lawn"
    assert sample_product_data["name"] == "Test Fertilizer"
    assert sample_gdd_model_data["name"] == "Test GDD Model"

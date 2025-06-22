"""
Test to verify test infrastructure is working correctly.
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
def test_health_endpoint(client: TestClient):
    """Test the health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.unit
def test_version_endpoint(client: TestClient):
    """Test the version endpoint."""
    response = client.get("/api/v1/version")
    assert response.status_code == 200
    data = response.json()
    assert "version" in data
    assert "build_date" in data


@pytest.mark.unit
def test_docs_endpoint(client: TestClient):
    """Test that API docs are accessible."""
    response = client.get("/api/v1/docs")
    assert response.status_code == 200


@pytest.mark.unit
def test_openapi_endpoint(client: TestClient):
    """Test that OpenAPI schema is accessible."""
    response = client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert "openapi" in data
    assert "info" in data
    assert "paths" in data


@pytest.mark.unit
def test_fixtures_work(db_session):
    """Test that database session fixture works."""
    assert db_session is not None


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

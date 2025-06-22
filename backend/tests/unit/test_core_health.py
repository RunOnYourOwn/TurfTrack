import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import redis.exceptions
from app.core.health import check_database, check_redis, check_celery


@pytest.mark.asyncio
async def test_check_database_success():
    """Test successful database health check."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_session.execute.return_value = mock_result

    with patch("app.core.health.async_session_maker") as mock_session_maker:
        mock_session_maker.return_value.__aenter__.return_value = mock_session

        result = await check_database()

        assert result["status"] == "healthy"
        assert "response_time_ms" in result
        assert isinstance(result["response_time_ms"], float)
        mock_session.execute.assert_called_once()


@pytest.mark.asyncio
async def test_check_database_failure():
    """Test database health check failure."""
    with patch("app.core.health.async_session_maker") as mock_session_maker:
        mock_session_maker.return_value.__aenter__.side_effect = Exception(
            "Database connection failed"
        )

        result = await check_database()

        assert result["status"] == "unhealthy"
        assert "response_time_ms" in result
        assert "error" in result
        assert result["error"] == "Database connection failed"


@pytest.mark.asyncio
async def test_check_redis_success():
    """Test successful Redis health check."""
    mock_redis = AsyncMock()
    mock_redis.ping.return_value = True

    result = await check_redis(mock_redis)

    assert result["status"] == "healthy"
    assert "response_time_ms" in result
    assert isinstance(result["response_time_ms"], float)
    mock_redis.ping.assert_called_once()


@pytest.mark.asyncio
async def test_check_redis_connection_error():
    """Test Redis health check with connection error."""
    mock_redis = AsyncMock()
    mock_redis.ping.side_effect = redis.exceptions.ConnectionError(
        "Redis connection failed"
    )

    result = await check_redis(mock_redis)

    assert result["status"] == "unhealthy"
    assert "response_time_ms" in result
    assert "error" in result
    assert result["error"] == "Redis connection failed"


@pytest.mark.asyncio
async def test_check_celery_success():
    """Test successful Celery health check."""
    mock_redis = AsyncMock()
    mock_redis.ping.return_value = True

    result = await check_celery(mock_redis)

    assert result["status"] == "healthy"
    assert "response_time_ms" in result
    assert isinstance(result["response_time_ms"], float)
    mock_redis.ping.assert_called_once()


@pytest.mark.asyncio
async def test_check_celery_connection_error():
    """Test Celery health check with connection error."""
    mock_redis = AsyncMock()
    mock_redis.ping.side_effect = redis.exceptions.ConnectionError(
        "Celery broker connection failed"
    )

    result = await check_celery(mock_redis)

    assert result["status"] == "unhealthy"
    assert "response_time_ms" in result
    assert "error" in result
    assert result["error"] == "Celery broker connection failed"

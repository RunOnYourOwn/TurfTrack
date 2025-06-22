import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import date
from app.utils.weather import upsert_daily_weather_sync, trigger_weather_fetch_if_needed
from app.models.daily_weather import WeatherType


@pytest.fixture
def mock_session():
    return MagicMock()


def test_upsert_daily_weather_sync_inserts_and_updates(mock_session):
    # Arrange
    data = {
        "temperature_max_c": 25.0,
        "temperature_max_f": 77.0,
        "temperature_min_c": 15.0,
        "temperature_min_f": 59.0,
        "precipitation_mm": 2.0,
        "precipitation_in": 0.08,
        "precipitation_probability_max": 10.0,
        "wind_speed_max_ms": 5.0,
        "wind_speed_max_mph": 11.2,
        "wind_gusts_max_ms": 7.0,
        "wind_gusts_max_mph": 15.7,
        "wind_direction_dominant_deg": 180.0,
        "et0_evapotranspiration_mm": 3.0,
        "et0_evapotranspiration_in": 0.12,
    }
    # Act
    upsert_daily_weather_sync(
        mock_session,
        location_id=1,
        date=date(2024, 1, 1),
        weather_type=WeatherType.historical,
        data=data,
    )
    # Assert
    assert mock_session.execute.called
    assert mock_session.commit.called


@pytest.mark.asyncio
async def test_trigger_weather_fetch_if_needed_triggers_fetch(monkeypatch):
    # Arrange
    mock_db = AsyncMock()
    lawn = MagicMock()
    lawn.weather_enabled = True
    lawn.location = MagicMock(latitude=1.0, longitude=2.0)
    lawn.location_id = 1

    # Mock the database query result - simulate no weather exists
    mock_result = MagicMock()
    mock_result.scalar.return_value = False
    mock_db.execute.return_value = mock_result

    with patch("app.utils.weather.fetch_and_store_weather") as mock_fetch:
        mock_fetch.delay = MagicMock()
        # Act
        await trigger_weather_fetch_if_needed(mock_db, lawn)
        # Assert
        mock_fetch.delay.assert_called_once()

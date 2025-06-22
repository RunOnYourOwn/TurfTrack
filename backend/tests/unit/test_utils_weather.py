import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import date
from app.utils.weather import upsert_daily_weather_sync, trigger_weather_fetch_if_needed
from app.models.daily_weather import WeatherType
import datetime
import app.utils.weather as weather


@pytest.mark.asyncio
async def test_trigger_weather_fetch_if_needed_weather_exists():
    db = AsyncMock()
    lawn = MagicMock()
    lawn.weather_enabled = True
    lawn.location = MagicMock()
    lawn.location_id = 1
    # Simulate weather exists
    db.execute.return_value.scalar.return_value = True
    with (
        patch("app.utils.weather.uuid.uuid4", return_value="uuid"),
        patch("app.utils.weather.logging.getLogger") as mock_logger,
    ):
        await weather.trigger_weather_fetch_if_needed(db, lawn)
        db.add.assert_called()
        db.commit.assert_called()
        mock_logger.return_value.info.assert_called()


@pytest.mark.asyncio
async def test_upsert_daily_weather_existing():
    session = AsyncMock()
    location_id = 1
    date = datetime.date.today()
    type = WeatherType.historical
    data = {"temperature_max_c": 25}
    # Simulate existing record
    existing = MagicMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = existing
    session.execute.return_value = mock_result
    await weather.upsert_daily_weather(session, location_id, date, type, data)
    assert existing.temperature_max_c == 25
    session.commit.assert_called()


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


@pytest.mark.asyncio
async def test_upsert_daily_weather_update():
    session = AsyncMock()
    existing = MagicMock()
    scalars = MagicMock()
    scalars.first.return_value = existing
    result = MagicMock()
    result.scalars.return_value = scalars
    session.execute.return_value = result
    data = {"temperature_max_c": 25.0}
    await weather.upsert_daily_weather(
        session, 1, datetime.date(2024, 1, 1), WeatherType.historical, data
    )
    assert existing.temperature_max_c == 25.0
    session.add.assert_not_called()
    assert session.commit.await_count == 2  # One for update, one for forecast delete


@pytest.mark.asyncio
async def test_upsert_daily_weather_insert():
    session = AsyncMock()
    scalars = MagicMock()
    scalars.first.return_value = None
    result = MagicMock()
    result.scalars.return_value = scalars
    session.execute.return_value = result
    data = {"temperature_max_c": 30.0}
    # Don't patch DailyWeather for select, just for instantiation
    with patch(
        "app.models.daily_weather.DailyWeather", wraps=weather.DailyWeather
    ) as MockWeather:
        await weather.upsert_daily_weather(
            session, 2, datetime.date(2024, 1, 2), WeatherType.historical, data
        )
        session.add.assert_called()
        assert session.commit.await_count == 2


@pytest.mark.asyncio
async def test_upsert_daily_weather_forecast_type():
    session = AsyncMock()
    scalars = MagicMock()
    scalars.first.return_value = None
    result = MagicMock()
    result.scalars.return_value = scalars
    session.execute.return_value = result
    data = {"temperature_max_c": 20.0}
    with patch(
        "app.models.daily_weather.DailyWeather", wraps=weather.DailyWeather
    ) as MockWeather:
        await weather.upsert_daily_weather(
            session, 3, datetime.date(2024, 1, 3), WeatherType.forecast, data
        )
        session.add.assert_called()
        # Only one commit for forecast type
        assert session.commit.await_count == 1


def test_upsert_daily_weather_sync_upsert_and_delete():
    session = MagicMock()
    with patch("sqlalchemy.text") as mock_text:
        upsert_stmt = MagicMock()
        delete_stmt = MagicMock()
        mock_text.side_effect = [upsert_stmt, delete_stmt]
        session.execute.return_value = None
        session.commit.return_value = None
        data = {"temperature_max_c": 22.0}
        weather.upsert_daily_weather_sync(
            session, 4, datetime.date(2024, 1, 4), WeatherType.historical, data
        )
        assert session.execute.call_count == 2
        assert session.commit.call_count == 2


def test_upsert_daily_weather_sync_forecast_type():
    session = MagicMock()
    with patch("sqlalchemy.text") as mock_text:
        upsert_stmt = MagicMock()
        mock_text.side_effect = [upsert_stmt]
        session.execute.return_value = None
        session.commit.return_value = None
        data = {"temperature_max_c": 18.0}
        weather.upsert_daily_weather_sync(
            session, 5, datetime.date(2024, 1, 5), WeatherType.forecast, data
        )
        assert session.execute.call_count == 1
        assert session.commit.call_count == 1


@pytest.mark.asyncio
async def test_trigger_weather_fetch_if_needed_fetch():
    db = AsyncMock()
    lawn = MagicMock()
    lawn.weather_enabled = True
    lawn.location = MagicMock()
    lawn.location_id = 10
    lawn.location.latitude = 1.1
    lawn.location.longitude = 2.2
    # Use regular MagicMock for scalar
    scalar_mock = MagicMock(return_value=False)
    db.execute.return_value.scalar = scalar_mock
    with patch("app.utils.weather.fetch_and_store_weather.delay") as mock_delay:
        await weather.trigger_weather_fetch_if_needed(db, lawn)
        mock_delay.assert_called_once_with(10, 1.1, 2.2)


@pytest.mark.asyncio
async def test_trigger_weather_fetch_if_needed_no_fetch():
    db = AsyncMock()
    lawn = MagicMock()
    lawn.weather_enabled = True
    lawn.location = MagicMock()
    lawn.location_id = 11
    lawn.location.latitude = 3.3
    lawn.location.longitude = 4.4
    scalar_mock = AsyncMock(return_value=True)
    db.execute.return_value.scalar = scalar_mock
    with patch("app.utils.weather.TaskStatus") as MockTaskStatus:
        mock_status = MagicMock()
        MockTaskStatus.return_value = mock_status
        await weather.trigger_weather_fetch_if_needed(db, lawn)
        db.add.assert_called_once_with(mock_status)
        db.commit.assert_awaited_once()

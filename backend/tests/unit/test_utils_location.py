import pytest
from unittest.mock import AsyncMock, MagicMock
from app.utils.location import get_or_create_location, cleanup_orphaned_location
from app.models.lawn import Lawn
from app.models.location import Location
from app.models.daily_weather import DailyWeather
from app.models.task_status import TaskStatus


class DummyLocation:
    def __init__(self, latitude, longitude):
        self.latitude = latitude
        self.longitude = longitude


@pytest.mark.asyncio
async def test_get_or_create_location_found():
    session = AsyncMock()
    dummy_location = DummyLocation(1.0, 2.0)
    scalars = MagicMock()
    scalars.first.return_value = dummy_location
    result = MagicMock()
    result.scalars.return_value = scalars
    session.execute.return_value = result

    loc = await get_or_create_location(session, 1.0, 2.0)
    assert loc is dummy_location
    session.add.assert_not_called()
    session.commit.assert_not_called()
    session.refresh.assert_not_called()


@pytest.mark.asyncio
async def test_get_or_create_location_not_found():
    session = AsyncMock()
    scalars = MagicMock()
    scalars.first.return_value = None
    result = MagicMock()
    result.scalars.return_value = scalars
    session.execute.return_value = result

    loc = await get_or_create_location(session, 3.0, 4.0)
    # Check that a new object was added with correct attributes
    session.add.assert_called_once()
    added_obj = session.add.call_args[0][0]
    assert hasattr(added_obj, "latitude")
    assert hasattr(added_obj, "longitude")
    assert added_obj.latitude == 3.0
    assert added_obj.longitude == 4.0
    session.commit.assert_awaited_once()
    session.refresh.assert_awaited_once_with(added_obj)


@pytest.mark.asyncio
async def test_cleanup_orphaned_location_with_remaining_lawns():
    """Test that location is not cleaned up when it still has lawns."""
    db = AsyncMock()

    # Mock that there are still lawns using this location
    mock_lawn = MagicMock()
    scalars = MagicMock()
    scalars.all.return_value = [mock_lawn]
    result = MagicMock()
    result.scalars.return_value = scalars
    db.execute.return_value = result

    result = await cleanup_orphaned_location(db, 1)

    # Location should not be cleaned up
    assert result is False
    # Should not have called any delete operations
    db.execute.assert_called_once()  # Only the check for remaining lawns


@pytest.mark.asyncio
async def test_cleanup_orphaned_location_no_remaining_lawns():
    """Test that location is cleaned up when no lawns remain."""
    db = AsyncMock()

    # Mock that no lawns are using this location
    scalars = MagicMock()
    scalars.all.return_value = []
    result = MagicMock()
    result.scalars.return_value = scalars
    db.execute.return_value = result

    # Mock the location object
    mock_location = MagicMock()
    db.get.return_value = mock_location

    result = await cleanup_orphaned_location(db, 1)

    # Location should be cleaned up
    assert result is True

    # Should have called delete operations for weather data, task status, and location
    assert db.execute.call_count == 3  # Check lawns, delete weather, delete task status
    db.get.assert_called_once_with(Location, 1)
    db.delete.assert_called_once_with(mock_location)
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_cleanup_orphaned_location_location_not_found():
    """Test cleanup when location doesn't exist (edge case)."""
    db = AsyncMock()

    # Mock that no lawns are using this location
    scalars = MagicMock()
    scalars.all.return_value = []
    result = MagicMock()
    result.scalars.return_value = scalars
    db.execute.return_value = result

    # Mock that location doesn't exist
    db.get.return_value = None

    result = await cleanup_orphaned_location(db, 999)

    # Should still return True (cleanup attempted)
    assert result is True

    # Should have called delete operations but not delete the location
    assert db.execute.call_count == 3  # Check lawns, delete weather, delete task status
    db.get.assert_called_once_with(Location, 999)
    db.delete.assert_not_called()  # No location to delete
    db.commit.assert_called_once()

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.utils.location import get_or_create_location


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

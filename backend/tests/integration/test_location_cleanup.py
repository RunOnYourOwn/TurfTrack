"""
Integration tests for location cleanup functionality.
Tests the complete workflow when lawns are deleted or moved between locations.
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.lawn import Lawn, GrassType, WeatherFetchFrequency
from app.models.location import Location
from app.models.daily_weather import DailyWeather, WeatherType
from app.models.task_status import TaskStatus, TaskStatusEnum
from app.utils.location import cleanup_orphaned_location
from datetime import datetime, timezone
import random


@pytest_asyncio.fixture
async def test_locations(db_session: AsyncSession):
    """Create test locations for testing."""
    locations = []
    for i in range(3):
        location = Location(
            name=f"Test Location {i}_{random.randint(1000, 9999)}",
            latitude=40.0 + random.random(),
            longitude=-74.0 + random.random(),
        )
        db_session.add(location)
        await db_session.commit()
        await db_session.refresh(location)
        locations.append(location)
    return locations


@pytest_asyncio.fixture
async def test_lawns(db_session: AsyncSession, test_locations):
    """Create test lawns for testing."""
    lawns = []
    for i, location in enumerate(test_locations):
        lawn = Lawn(
            name=f"Test Lawn {i}",
            area=5000.0 + i * 1000,
            grass_type=GrassType.cold_season,
            weather_fetch_frequency=WeatherFetchFrequency.twentyfour_h,
            timezone="UTC",
            weather_enabled=True,
            location_id=location.id,
        )
        db_session.add(lawn)
        await db_session.commit()
        await db_session.refresh(lawn)
        lawns.append(lawn)
    return lawns


@pytest_asyncio.fixture
async def test_weather_data(db_session: AsyncSession, test_locations):
    """Create test weather data for locations."""
    weather_entries = []
    for location in test_locations:
        weather = DailyWeather(
            location_id=location.id,
            date=datetime.now(timezone.utc).date(),
            type=WeatherType.historical,
            temperature_max_c=25.0,
            temperature_max_f=77.0,
            temperature_min_c=15.0,
            temperature_min_f=59.0,
            precipitation_mm=0.0,
            precipitation_in=0.0,
            precipitation_probability_max=0.0,
            wind_speed_max_ms=10.0,
            wind_speed_max_mph=22.4,
            wind_gusts_max_ms=15.0,
            wind_gusts_max_mph=33.6,
            wind_direction_dominant_deg=180.0,
            et0_evapotranspiration_mm=3.0,
            et0_evapotranspiration_in=0.12,
        )
        db_session.add(weather)
        await db_session.commit()
        await db_session.refresh(weather)
        weather_entries.append(weather)
    return weather_entries


@pytest_asyncio.fixture
async def test_task_status(db_session: AsyncSession, test_locations):
    """Create test task status records for locations."""
    task_statuses = []
    for location in test_locations:
        task_status = TaskStatus(
            task_id=f"test-task-{location.id}",
            task_name="test_weather_task",
            related_location_id=location.id,
            status=TaskStatusEnum.success,
            created_at=datetime.now(timezone.utc),
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
        )
        db_session.add(task_status)
        await db_session.commit()
        await db_session.refresh(task_status)
        task_statuses.append(task_status)
    return task_statuses


@pytest.mark.integration
@pytest.mark.asyncio
async def test_location_cleanup_when_last_lawn_deleted(
    db_session: AsyncSession,
    test_locations,
    test_lawns,
    test_weather_data,
    test_task_status,
):
    """Test that location is cleaned up when the last lawn is deleted."""
    # Get the first location and its lawn
    location = test_locations[0]
    lawn = test_lawns[0]

    # Verify initial state
    assert lawn.location_id == location.id

    # Delete the lawn
    await db_session.delete(lawn)
    await db_session.commit()

    # Clean up the location
    result = await cleanup_orphaned_location(db_session, location.id)

    # Should have cleaned up the location
    assert result is True

    # Verify location and related data are deleted
    location_check = await db_session.get(Location, location.id)
    assert location_check is None

    weather_check = await db_session.execute(
        DailyWeather.__table__.select().where(DailyWeather.location_id == location.id)
    )
    assert len(weather_check.fetchall()) == 0

    task_status_check = await db_session.execute(
        TaskStatus.__table__.select().where(
            TaskStatus.related_location_id == location.id
        )
    )
    assert len(task_status_check.fetchall()) == 0


@pytest.mark.integration
@pytest.mark.asyncio
async def test_location_preserved_when_multiple_lawns_exist(
    db_session: AsyncSession,
    test_locations,
    test_lawns,
    test_weather_data,
    test_task_status,
):
    """Test that location is preserved when multiple lawns exist."""
    # Create a second lawn for the first location
    location = test_locations[0]
    second_lawn = Lawn(
        name="Second Test Lawn",
        area=6000.0,
        grass_type=GrassType.warm_season,
        weather_fetch_frequency=WeatherFetchFrequency.twentyfour_h,
        timezone="UTC",
        weather_enabled=True,
        location_id=location.id,
    )
    db_session.add(second_lawn)
    await db_session.commit()
    await db_session.refresh(second_lawn)

    # Delete one lawn
    first_lawn = test_lawns[0]
    await db_session.delete(first_lawn)
    await db_session.commit()

    # Try to clean up the location
    result = await cleanup_orphaned_location(db_session, location.id)

    # Should not have cleaned up the location
    assert result is False

    # Verify location and related data are preserved
    location_check = await db_session.get(Location, location.id)
    assert location_check is not None

    weather_check = await db_session.execute(
        DailyWeather.__table__.select().where(DailyWeather.location_id == location.id)
    )
    assert len(weather_check.fetchall()) > 0

    task_status_check = await db_session.execute(
        TaskStatus.__table__.select().where(
            TaskStatus.related_location_id == location.id
        )
    )
    assert len(task_status_check.fetchall()) > 0


@pytest.mark.integration
@pytest.mark.asyncio
async def test_location_cleanup_when_lawn_moved_to_different_location(
    db_session: AsyncSession,
    test_locations,
    test_lawns,
    test_weather_data,
    test_task_status,
):
    """Test that old location is cleaned up when lawn is moved to a different location."""
    # Get two different locations
    location1 = test_locations[0]
    location2 = test_locations[1]
    lawn = test_lawns[0]

    # Verify initial state
    assert lawn.location_id == location1.id

    # Move the lawn to the second location
    lawn.location_id = location2.id
    await db_session.commit()
    await db_session.refresh(lawn)

    # Clean up the old location
    result = await cleanup_orphaned_location(db_session, location1.id)

    # Should have cleaned up the old location
    assert result is True

    # Verify old location and related data are deleted
    location1_check = await db_session.get(Location, location1.id)
    assert location1_check is None

    weather_check = await db_session.execute(
        DailyWeather.__table__.select().where(DailyWeather.location_id == location1.id)
    )
    assert len(weather_check.fetchall()) == 0

    task_status_check = await db_session.execute(
        TaskStatus.__table__.select().where(
            TaskStatus.related_location_id == location1.id
        )
    )
    assert len(task_status_check.fetchall()) == 0

    # Verify new location is preserved
    location2_check = await db_session.get(Location, location2.id)
    assert location2_check is not None

    # Verify lawn is now associated with the new location
    await db_session.refresh(lawn)
    assert lawn.location_id == location2.id

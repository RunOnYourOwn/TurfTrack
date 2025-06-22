"""
Unit tests for TurfTrack database models: Lawn, Product, GDDModel.
"""

import pytest
import pytest_asyncio
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.lawn import Lawn, GrassType, WeatherFetchFrequency
from app.models.product import Product
from app.models.gdd import GDDModel, TempUnit
from datetime import datetime, date, timezone
from app.models.location import Location
import random


@pytest_asyncio.fixture
async def test_location(db_session: AsyncSession) -> Location:
    """Create a test location for foreign key relationships."""
    lat = 40.0 + random.random()
    lon = -74.0 + random.random()
    location = Location(
        latitude=lat,
        longitude=lon,
    )
    db_session.add(location)
    await db_session.commit()
    return location


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_lawn(db_session: AsyncSession, test_location: Location):
    """Test creating a lawn with valid data."""
    lawn = Lawn(
        name="Test Lawn",
        area=5000.0,
        grass_type=GrassType.cold_season,
        notes="Test notes",
        weather_fetch_frequency=WeatherFetchFrequency.twentyfour_h,
        timezone="UTC",
        weather_enabled=True,
        location_id=test_location.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(lawn)
    await db_session.commit()
    await db_session.refresh(lawn)
    assert lawn.id is not None
    assert lawn.name == "Test Lawn"
    assert lawn.area == 5000.0
    assert lawn.grass_type == GrassType.cold_season


@pytest.mark.unit
@pytest.mark.asyncio
async def test_lawn_required_fields(db_session: AsyncSession, test_location: Location):
    """Test that lawn creation fails without required fields."""
    lawn = Lawn(
        area=5000.0,
        grass_type=GrassType.cold_season,
        weather_fetch_frequency=WeatherFetchFrequency.twentyfour_h,
        timezone="UTC",
        weather_enabled=True,
        location_id=test_location.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(lawn)
    with pytest.raises(IntegrityError):
        await db_session.commit()


@pytest_asyncio.fixture
async def lawn_for_fk(db_session: AsyncSession, test_location: Location) -> Lawn:
    """Create a lawn for foreign key relationships."""
    lawn = Lawn(
        name="Test Lawn for FK",
        area=5000.0,
        grass_type=GrassType.cold_season,
        weather_fetch_frequency=WeatherFetchFrequency.twentyfour_h,
        timezone="UTC",
        weather_enabled=True,
        location_id=test_location.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(lawn)
    await db_session.commit()
    await db_session.refresh(lawn)
    return lawn


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_product(db_session: AsyncSession):
    """Test creating a product with valid data."""
    product = Product(
        name="Test Fertilizer",
        n_pct=20.0,
        p_pct=10.0,
        k_pct=10.0,
        cost_per_bag=10.0,
        weight_lbs=4.0,
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    assert product.id is not None
    assert product.name == "Test Fertilizer"
    assert product.n_pct == 20.0
    assert product.p_pct == 10.0
    assert product.k_pct == 10.0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_product_required_fields(db_session: AsyncSession):
    """Test that product creation fails without required fields."""
    product = Product(
        n_pct=20.0,
        p_pct=10.0,
        k_pct=10.0,
        cost_per_bag=10.0,
        weight_lbs=4.0,
    )
    db_session.add(product)
    with pytest.raises(IntegrityError):
        await db_session.commit()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_gdd_model(db_session: AsyncSession, lawn_for_fk: Lawn):
    """Test creating a GDD model with valid data."""
    gdd_model = GDDModel(
        name="Test GDD Model",
        base_temp=10.0,
        unit=TempUnit.C,
        start_date=date.today(),
        threshold=1000.0,
        lawn_id=lawn_for_fk.id,
    )
    db_session.add(gdd_model)
    await db_session.commit()
    await db_session.refresh(gdd_model)
    assert gdd_model.id is not None
    assert gdd_model.name == "Test GDD Model"
    assert gdd_model.base_temp == 10.0
    assert gdd_model.unit == TempUnit.C


@pytest.mark.unit
@pytest.mark.asyncio
async def test_gdd_model_required_fields(db_session: AsyncSession, lawn_for_fk: Lawn):
    """Test that GDD model creation fails without required fields."""
    gdd_model = GDDModel(
        base_temp=10.0,
        unit=TempUnit.C,
        start_date=date.today(),
        threshold=1000.0,
        lawn_id=lawn_for_fk.id,
    )
    db_session.add(gdd_model)
    with pytest.raises(IntegrityError):
        await db_session.commit()

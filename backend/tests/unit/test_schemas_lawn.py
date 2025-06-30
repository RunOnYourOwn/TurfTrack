import pytest
from pydantic import ValidationError
from app.schemas.lawn import LawnCreate, LawnUpdate
from app.models.lawn import GrassType, WeatherFetchFrequency


class TestLawnCreate:
    """Test LawnCreate schema validation."""

    def test_valid_lawn_creation(self):
        """Test creating a lawn with valid data."""
        data = {
            "name": "Test Lawn",
            "area": 1000.0,
            "grass_type": GrassType.cold_season,
            "weather_fetch_frequency": WeatherFetchFrequency.twentyfour_h,
            "timezone": "America/New_York",
            "location_id": 1,
        }
        lawn = LawnCreate(**data)
        assert lawn.name == "Test Lawn"
        assert lawn.area == 1000.0
        assert lawn.location_id == 1

    def test_area_validation_valid(self):
        """Test area validation with valid values."""
        valid_areas = [0.1, 1.0, 100.0, 10000.0]
        for area in valid_areas:
            data = {
                "name": "Test",
                "area": area,
                "grass_type": GrassType.cold_season,
                "weather_fetch_frequency": WeatherFetchFrequency.twentyfour_h,
                "timezone": "America/New_York",
                "location_id": 1,
            }
            lawn = LawnCreate(**data)
            assert lawn.area == area

    def test_area_validation_invalid_zero(self):
        """Test area validation with zero."""
        with pytest.raises(ValidationError, match="Area must be greater than 0"):
            LawnCreate(
                name="Test",
                area=0.0,
                grass_type=GrassType.cold_season,
                weather_fetch_frequency=WeatherFetchFrequency.twentyfour_h,
                timezone="America/New_York",
                location_id=1,
            )

    def test_area_validation_invalid_negative(self):
        """Test area validation with negative values."""
        invalid_areas = [-1.0, -10.0, -100.0]
        for area in invalid_areas:
            with pytest.raises(ValidationError, match="Area must be greater than 0"):
                LawnCreate(
                    name="Test",
                    area=area,
                    grass_type=GrassType.cold_season,
                    weather_fetch_frequency=WeatherFetchFrequency.twentyfour_h,
                    timezone="America/New_York",
                    location_id=1,
                )

    def test_grass_type_validation(self):
        """Test grass type validation."""
        valid_grass_types = [GrassType.cold_season, GrassType.warm_season]
        for grass_type in valid_grass_types:
            data = {
                "name": "Test",
                "area": 100.0,
                "grass_type": grass_type,
                "weather_fetch_frequency": WeatherFetchFrequency.twentyfour_h,
                "timezone": "America/New_York",
                "location_id": 1,
            }
            lawn = LawnCreate(**data)
            assert lawn.grass_type == grass_type

    def test_weather_fetch_frequency_validation(self):
        """Test weather fetch frequency validation."""
        valid_frequencies = [
            WeatherFetchFrequency.four_h,
            WeatherFetchFrequency.eight_h,
            WeatherFetchFrequency.twelve_h,
            WeatherFetchFrequency.twentyfour_h,
        ]
        for frequency in valid_frequencies:
            data = {
                "name": "Test",
                "area": 100.0,
                "grass_type": GrassType.cold_season,
                "weather_fetch_frequency": frequency,
                "timezone": "America/New_York",
                "location_id": 1,
            }
            lawn = LawnCreate(**data)
            assert lawn.weather_fetch_frequency == frequency


class TestLawnUpdate:
    """Test LawnUpdate schema validation."""

    def test_partial_update_valid(self):
        """Test partial update with valid data."""
        data = {"name": "Updated Lawn", "area": 1500.0}
        lawn = LawnUpdate(**data)
        assert lawn.name == "Updated Lawn"
        assert lawn.area == 1500.0

    def test_update_area_validation(self):
        """Test area validation in updates."""
        # Test invalid area
        with pytest.raises(ValidationError, match="Area must be greater than 0"):
            LawnUpdate(name="Test", area=0.0)

        with pytest.raises(ValidationError, match="Area must be greater than 0"):
            LawnUpdate(name="Test", area=-10.0)

        # Test valid area
        lawn = LawnUpdate(name="Test", area=500.0)
        assert lawn.area == 500.0

    def test_update_with_none_values(self):
        """Test that None values are allowed in updates."""
        data = {"name": "Test", "area": None, "location_id": None}
        lawn = LawnUpdate(**data)
        assert lawn.name == "Test"
        assert lawn.area is None
        assert lawn.location_id is None

    def test_empty_update(self):
        """Test creating an update with no fields."""
        lawn = LawnUpdate()
        assert lawn.name is None
        assert lawn.area is None
        assert lawn.location_id is None

    def test_update_with_location_id(self):
        """Test updating location_id."""
        data = {"location_id": 2}
        lawn = LawnUpdate(**data)
        assert lawn.location_id == 2

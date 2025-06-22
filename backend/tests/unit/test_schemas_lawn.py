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
            "latitude": 40.7128,
            "longitude": -74.0060,
        }
        lawn = LawnCreate(**data)
        assert lawn.name == "Test Lawn"
        assert lawn.area == 1000.0
        assert lawn.latitude == 40.7128
        assert lawn.longitude == -74.0060

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
                "latitude": 40.0,
                "longitude": -74.0,
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
                latitude=40.0,
                longitude=-74.0,
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
                    latitude=40.0,
                    longitude=-74.0,
                )

    def test_latitude_validation_valid(self):
        """Test latitude validation with valid values."""
        valid_latitudes = [-90.0, -45.0, 0.0, 45.0, 90.0]
        for lat in valid_latitudes:
            data = {
                "name": "Test",
                "area": 100.0,
                "grass_type": GrassType.cold_season,
                "weather_fetch_frequency": WeatherFetchFrequency.twentyfour_h,
                "timezone": "America/New_York",
                "latitude": lat,
                "longitude": -74.0,
            }
            lawn = LawnCreate(**data)
            assert lawn.latitude == lat

    def test_latitude_validation_invalid(self):
        """Test latitude validation with invalid values."""
        invalid_latitudes = [-90.1, 90.1, -100.0, 100.0]
        for lat in invalid_latitudes:
            with pytest.raises(ValidationError):
                LawnCreate(
                    name="Test",
                    area=100.0,
                    grass_type=GrassType.cold_season,
                    weather_fetch_frequency=WeatherFetchFrequency.twentyfour_h,
                    timezone="America/New_York",
                    latitude=lat,
                    longitude=-74.0,
                )

    def test_longitude_validation_valid(self):
        """Test longitude validation with valid values."""
        valid_longitudes = [-180.0, -90.0, 0.0, 90.0, 180.0]
        for lon in valid_longitudes:
            data = {
                "name": "Test",
                "area": 100.0,
                "grass_type": GrassType.cold_season,
                "weather_fetch_frequency": WeatherFetchFrequency.twentyfour_h,
                "timezone": "America/New_York",
                "latitude": 40.0,
                "longitude": lon,
            }
            lawn = LawnCreate(**data)
            assert lawn.longitude == lon

    def test_longitude_validation_invalid(self):
        """Test longitude validation with invalid values."""
        invalid_longitudes = [-180.1, 180.1, -200.0, 200.0]
        for lon in invalid_longitudes:
            with pytest.raises(ValidationError):
                LawnCreate(
                    name="Test",
                    area=100.0,
                    grass_type=GrassType.cold_season,
                    weather_fetch_frequency=WeatherFetchFrequency.twentyfour_h,
                    timezone="America/New_York",
                    latitude=40.0,
                    longitude=lon,
                )

    def test_edge_case_coordinates(self):
        """Test edge case coordinates (boundary values)."""
        # Test exact boundary values
        data = {
            "name": "Edge Case",
            "area": 1.0,
            "grass_type": GrassType.cold_season,
            "weather_fetch_frequency": WeatherFetchFrequency.twentyfour_h,
            "timezone": "America/New_York",
            "latitude": 90.0,  # Maximum latitude
            "longitude": 180.0,  # Maximum longitude
        }
        lawn = LawnCreate(**data)
        assert lawn.latitude == 90.0
        assert lawn.longitude == 180.0

        # Test negative boundary values
        data = {
            "name": "Negative Edge",
            "area": 1.0,
            "grass_type": GrassType.cold_season,
            "weather_fetch_frequency": WeatherFetchFrequency.twentyfour_h,
            "timezone": "America/New_York",
            "latitude": -90.0,  # Minimum latitude
            "longitude": -180.0,  # Minimum longitude
        }
        lawn = LawnCreate(**data)
        assert lawn.latitude == -90.0
        assert lawn.longitude == -180.0

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
                "latitude": 40.0,
                "longitude": -74.0,
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
                "latitude": 40.0,
                "longitude": -74.0,
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
        assert lawn.latitude is None  # Not provided

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
        data = {"name": "Test", "area": None, "latitude": None}
        lawn = LawnUpdate(**data)
        assert lawn.name == "Test"
        assert lawn.area is None
        assert lawn.latitude is None

    def test_empty_update(self):
        """Test creating an update with no fields."""
        lawn = LawnUpdate()
        assert lawn.name is None
        assert lawn.area is None
        assert lawn.latitude is None
        assert lawn.longitude is None

    def test_update_with_coordinates(self):
        """Test updating coordinates."""
        data = {
            "latitude": 35.0,
            "longitude": -120.0,
        }
        lawn = LawnUpdate(**data)
        assert lawn.latitude == 35.0
        assert lawn.longitude == -120.0

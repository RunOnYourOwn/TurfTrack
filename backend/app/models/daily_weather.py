from sqlalchemy import Float, Date, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum


class WeatherType(enum.Enum):
    historical = "historical"
    forecast = "forecast"


class DailyWeather(Base):
    __tablename__ = "daily_weather"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    date: Mapped[Date] = mapped_column(Date, nullable=False)
    location_id: Mapped[int] = mapped_column(
        ForeignKey("locations.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[WeatherType] = mapped_column(Enum(WeatherType), nullable=False)

    temperature_max_c: Mapped[float] = mapped_column(Float, nullable=False)
    temperature_max_f: Mapped[float] = mapped_column(Float, nullable=False)
    temperature_min_c: Mapped[float] = mapped_column(Float, nullable=False)
    temperature_min_f: Mapped[float] = mapped_column(Float, nullable=False)
    precipitation_mm: Mapped[float] = mapped_column(Float, nullable=False)
    precipitation_in: Mapped[float] = mapped_column(Float, nullable=False)
    precipitation_probability_max: Mapped[float] = mapped_column(Float, nullable=False)
    wind_speed_max_ms: Mapped[float] = mapped_column(Float, nullable=False)
    wind_speed_max_mph: Mapped[float] = mapped_column(Float, nullable=False)
    wind_gusts_max_ms: Mapped[float] = mapped_column(Float, nullable=False)
    wind_gusts_max_mph: Mapped[float] = mapped_column(Float, nullable=False)
    wind_direction_dominant_deg: Mapped[float] = mapped_column(Float, nullable=False)
    et0_evapotranspiration_mm: Mapped[float] = mapped_column(Float, nullable=False)
    et0_evapotranspiration_in: Mapped[float] = mapped_column(Float, nullable=False)
    relative_humidity_mean: Mapped[float] = mapped_column(Float, nullable=True)
    relative_humidity_max: Mapped[float] = mapped_column(Float, nullable=True)
    relative_humidity_min: Mapped[float] = mapped_column(Float, nullable=True)
    dew_point_max_c: Mapped[float] = mapped_column(Float, nullable=True)
    dew_point_max_f: Mapped[float] = mapped_column(Float, nullable=True)
    dew_point_min_c: Mapped[float] = mapped_column(Float, nullable=True)
    dew_point_min_f: Mapped[float] = mapped_column(Float, nullable=True)
    dew_point_mean_c: Mapped[float] = mapped_column(Float, nullable=True)
    dew_point_mean_f: Mapped[float] = mapped_column(Float, nullable=True)
    sunshine_duration_s: Mapped[float] = mapped_column(Float, nullable=True)
    sunshine_duration_h: Mapped[float] = mapped_column(Float, nullable=True)

    location = relationship("Location", back_populates="weather_entries")

    __table_args__ = (
        UniqueConstraint("date", "location_id", "type", name="uix_date_location_type"),
    )

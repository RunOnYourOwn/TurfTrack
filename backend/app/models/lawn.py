from datetime import datetime
from sqlalchemy import String, DateTime, Float, Enum, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum


class GrassType(enum.Enum):
    cold_season = "cold_season"
    warm_season = "warm_season"


class WeatherFetchFrequency(enum.Enum):
    four_h = "4h"
    eight_h = "8h"
    twelve_h = "12h"
    twentyfour_h = "24h"


class Lawn(Base):
    __tablename__ = "lawns"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    area: Mapped[float] = mapped_column(Float, nullable=False)
    grass_type: Mapped[GrassType] = mapped_column(Enum(GrassType), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str] = mapped_column(String(500), nullable=True)
    weather_fetch_frequency: Mapped[WeatherFetchFrequency] = mapped_column(
        Enum(WeatherFetchFrequency),
        nullable=False,
        default=WeatherFetchFrequency.twentyfour_h,
    )
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)
    weather_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    location = relationship("Location", back_populates="lawns")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    gdd_models = relationship(
        "GDDModel", back_populates="lawn", cascade="all, delete-orphan"
    )

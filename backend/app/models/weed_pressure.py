from sqlalchemy import (
    Float,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Boolean,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum
from datetime import datetime


class WeedSeason(enum.Enum):
    spring = "spring"
    summer = "summer"
    fall = "fall"
    year_round = "year_round"


class MoisturePreference(enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class WeedSpecies(Base):
    __tablename__ = "weed_species"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    common_name: Mapped[str] = mapped_column(String(100), nullable=False)
    gdd_base_temp_c: Mapped[float] = mapped_column(Float, nullable=False)
    gdd_threshold_emergence: Mapped[float] = mapped_column(Float, nullable=False)
    optimal_soil_temp_min_c: Mapped[float] = mapped_column(Float, nullable=False)
    optimal_soil_temp_max_c: Mapped[float] = mapped_column(Float, nullable=False)
    moisture_preference: Mapped[MoisturePreference] = mapped_column(
        Enum(MoisturePreference), nullable=False
    )
    season: Mapped[WeedSeason] = mapped_column(Enum(WeedSeason), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    weed_pressure_entries = relationship("WeedPressure", back_populates="weed_species")


class WeedPressure(Base):
    __tablename__ = "weed_pressure"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    location_id: Mapped[int] = mapped_column(
        ForeignKey("locations.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[Date] = mapped_column(Date, nullable=False)
    weed_species_id: Mapped[int] = mapped_column(
        ForeignKey("weed_species.id", ondelete="CASCADE"), nullable=False
    )

    # Calculated scores
    weed_pressure_score: Mapped[float] = mapped_column(
        Float, nullable=False
    )  # 0-10 scale

    # Component scores
    gdd_risk_score: Mapped[float] = mapped_column(Float, nullable=False)  # 0-3
    soil_temp_risk_score: Mapped[float] = mapped_column(Float, nullable=False)  # 0-2
    moisture_risk_score: Mapped[float] = mapped_column(Float, nullable=False)  # 0-2
    turf_stress_score: Mapped[float] = mapped_column(Float, nullable=False)  # 0-2
    seasonal_timing_score: Mapped[float] = mapped_column(Float, nullable=False)  # 0-1

    # Calculation inputs (for debugging/validation)
    gdd_accumulated: Mapped[float] = mapped_column(Float, nullable=False)
    soil_temp_estimate_c: Mapped[float] = mapped_column(Float, nullable=False)
    precipitation_3day_mm: Mapped[float] = mapped_column(Float, nullable=False)
    humidity_avg: Mapped[float] = mapped_column(Float, nullable=False)
    et0_mm: Mapped[float] = mapped_column(Float, nullable=False)
    is_forecast: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # Relationships
    location = relationship("Location", back_populates="weed_pressure_entries")
    weed_species = relationship("WeedSpecies", back_populates="weed_pressure_entries")

    # Composite unique constraint
    __table_args__ = (
        UniqueConstraint(
            "location_id", "date", "weed_species_id", name="uix_location_date_species"
        ),
    )

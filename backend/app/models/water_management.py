from sqlalchemy import Float, String, Date, Integer, ForeignKey, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from datetime import datetime, date
from enum import Enum as PyEnum


class IrrigationSource(PyEnum):
    MANUAL = "manual"
    AUTOMATIC = "automatic"
    SCHEDULED = "scheduled"


class IrrigationEntry(Base):
    __tablename__ = "irrigation_entries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lawn_id: Mapped[int] = mapped_column(
        ForeignKey("lawns.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped["date"] = mapped_column(Date, nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)  # inches
    duration: Mapped[int] = mapped_column(Integer, nullable=False)  # minutes
    source: Mapped[IrrigationSource] = mapped_column(
        Enum(IrrigationSource), nullable=False, default=IrrigationSource.MANUAL
    )
    notes: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    lawn = relationship("Lawn", back_populates="irrigation_entries")


class WeeklyWaterSummary(Base):
    __tablename__ = "weekly_water_summaries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lawn_id: Mapped[int] = mapped_column(
        ForeignKey("lawns.id", ondelete="CASCADE"), nullable=False
    )
    week_start: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    week_end: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Weather data totals
    et0_total: Mapped[float] = mapped_column(Float, nullable=False)  # inches
    precipitation_total: Mapped[float] = mapped_column(Float, nullable=False)  # inches

    # Irrigation data totals
    irrigation_applied: Mapped[float] = mapped_column(Float, nullable=False)  # inches

    # Calculated values
    water_deficit: Mapped[float] = mapped_column(Float, nullable=False)  # inches
    status: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # excellent, good, warning, critical

    # Forecast tracking
    is_forecast: Mapped[bool] = mapped_column(
        default=False
    )  # True if includes forecast data

    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    lawn = relationship("Lawn", back_populates="weekly_water_summaries")

    # Composite unique constraint
    __table_args__ = (
        # Ensure one summary per lawn per week
        # Note: This will be added in the migration
    )

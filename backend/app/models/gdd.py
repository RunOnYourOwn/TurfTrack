from datetime import datetime
from sqlalchemy import (
    String,
    Date,
    DateTime,
    Float,
    Enum,
    Boolean,
    ForeignKey,
    UniqueConstraint,
    Column,
    Integer,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum


class TempUnit(enum.Enum):
    C = "C"
    F = "F"


class ResetType(enum.Enum):
    manual = "manual"
    threshold = "threshold"
    initial = "initial"
    application = "application"


class GDDModel(Base):
    __tablename__ = "gdd_models"
    __table_args__ = (UniqueConstraint("lawn_id", "name", name="uix_lawn_name"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lawn_id: Mapped[int] = mapped_column(ForeignKey("lawns.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    base_temp: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[TempUnit] = mapped_column(Enum(TempUnit), nullable=False)
    start_date: Mapped[Date] = mapped_column(Date, nullable=False)
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    reset_on_threshold: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    lawn = relationship("Lawn", back_populates="gdd_models")
    gdd_values = relationship(
        "GDDValue", back_populates="gdd_model", cascade="all, delete-orphan"
    )
    resets = relationship(
        "GDDReset", back_populates="gdd_model", cascade="all, delete-orphan"
    )
    parameter_history = relationship(
        "GDDModelParameters", back_populates="gdd_model", cascade="all, delete-orphan"
    )


class GDDModelParameters(Base):
    __tablename__ = "gdd_model_parameters"
    __table_args__ = (
        UniqueConstraint(
            "gdd_model_id", "effective_from", name="uix_gdd_model_effective_from"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    gdd_model_id: Mapped[int] = mapped_column(
        ForeignKey("gdd_models.id"), nullable=False
    )
    base_temp: Mapped[float] = mapped_column(Float, nullable=False)
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    reset_on_threshold: Mapped[bool] = mapped_column(Boolean, nullable=False)
    effective_from: Mapped[Date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    gdd_model = relationship("GDDModel", back_populates="parameter_history")


class GDDValue(Base):
    __tablename__ = "gdd_values"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    gdd_model_id: Mapped[int] = mapped_column(
        ForeignKey("gdd_models.id"), nullable=False
    )
    date: Mapped[Date] = mapped_column(Date, nullable=False)
    daily_gdd: Mapped[float] = mapped_column(Float, nullable=False)
    cumulative_gdd: Mapped[float] = mapped_column(Float, nullable=False)
    is_forecast: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    run: Mapped[int] = mapped_column(default=1, nullable=False)

    gdd_model = relationship("GDDModel", back_populates="gdd_values")


class GDDReset(Base):
    __tablename__ = "gdd_resets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    gdd_model_id: Mapped[int] = mapped_column(
        ForeignKey("gdd_models.id"), nullable=False
    )
    reset_date: Mapped[Date] = mapped_column(Date, nullable=False)
    run_number: Mapped[int] = mapped_column(Integer, nullable=False)
    reset_type: Mapped[ResetType] = mapped_column(Enum(ResetType), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    gdd_model = relationship("GDDModel", back_populates="resets")

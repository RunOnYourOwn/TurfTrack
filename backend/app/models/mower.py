from datetime import datetime, date
from sqlalchemy import String, Date, DateTime, Float, Integer, Enum, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum


class MowerType(enum.Enum):
    ROTARY = "rotary"  # Standard rotary mower
    REEL = "reel"  # Reel mower
    ZERO_TURN = "zero_turn"  # Zero-turn mower
    RIDING = "riding"  # Riding mower
    PUSH = "push"  # Push mower
    ELECTRIC = "electric"  # Electric mower
    ROBOTIC = "robotic"  # Robotic mower


class MaintenanceType(enum.Enum):
    # Engine Maintenance
    OIL_CHANGE = "oil_change"
    AIR_FILTER = "air_filter"
    SPARK_PLUG = "spark_plug"
    FUEL_FILTER = "fuel_filter"

    # Cutting System
    BLADE_SHARPENING = "blade_sharpening"
    BACKLAP = "backlap"  # For reel mowers
    REEL_GRINDING = "reel_grinding"  # For reel mowers
    BEDKNIFE_ADJUSTMENT = "bedknife_adjustment"  # For reel mowers

    # Drive System
    BELT_REPLACEMENT = "belt_replacement"
    GEAR_OIL_CHANGE = "gear_oil_change"
    TRANSMISSION_SERVICE = "transmission_service"

    # Electrical
    BATTERY_REPLACEMENT = "battery_replacement"
    ELECTRICAL_SYSTEM_CHECK = "electrical_system_check"

    # Tires/Wheels
    TIRE_REPLACEMENT = "tire_replacement"
    WHEEL_BEARING_SERVICE = "wheel_bearing_service"

    # Safety & Controls
    SAFETY_SWITCH_CHECK = "safety_switch_check"
    THROTTLE_ADJUSTMENT = "throttle_adjustment"

    # General
    GENERAL_SERVICE = "general_service"
    WINTERIZATION = "winterization"
    SPRING_STARTUP = "spring_startup"


class Mower(Base):
    __tablename__ = "mowers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    brand: Mapped[str] = mapped_column(String(100), nullable=True)
    model: Mapped[str] = mapped_column(String(100), nullable=True)
    year: Mapped[int] = mapped_column(Integer, nullable=True)
    mower_type: Mapped[MowerType] = mapped_column(
        Enum(MowerType), nullable=False, default=MowerType.ROTARY
    )
    engine_hours: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )  # Current engine hours
    default_mowing_time_minutes: Mapped[int] = mapped_column(Integer, nullable=True)
    notes: Mapped[str] = mapped_column(String(500), nullable=True)
    location_id: Mapped[int] = mapped_column(
        ForeignKey("locations.id", ondelete="CASCADE"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )  # For retired mowers
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    location = relationship("Location", back_populates="mowers")
    mowing_logs = relationship(
        "MowingLog", back_populates="mower", cascade="all, delete-orphan"
    )
    maintenance_schedules = relationship(
        "MaintenanceSchedule", back_populates="mower", cascade="all, delete-orphan"
    )
    maintenance_logs = relationship(
        "MaintenanceLog", back_populates="mower", cascade="all, delete-orphan"
    )


class MowingLog(Base):
    __tablename__ = "mowing_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    mower_id: Mapped[int] = mapped_column(
        ForeignKey("mowers.id", ondelete="CASCADE"), nullable=False
    )
    lawn_id: Mapped[int] = mapped_column(
        ForeignKey("lawns.id", ondelete="CASCADE"), nullable=False
    )
    mowing_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    mower = relationship("Mower", back_populates="mowing_logs")
    lawn = relationship("Lawn")


class MaintenanceSchedule(Base):
    __tablename__ = "maintenance_schedules"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    mower_id: Mapped[int] = mapped_column(
        ForeignKey("mowers.id", ondelete="CASCADE"), nullable=False
    )
    maintenance_type: Mapped[MaintenanceType] = mapped_column(
        Enum(MaintenanceType), nullable=False
    )
    custom_name: Mapped[str] = mapped_column(
        String(100), nullable=True
    )  # User-defined name for the maintenance
    interval_hours: Mapped[int] = mapped_column(
        Integer, nullable=False
    )  # Hours between maintenance
    interval_months: Mapped[int] = mapped_column(
        Integer, nullable=True
    )  # Alternative: months between maintenance
    last_maintenance_hours: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    last_maintenance_date: Mapped[date] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    mower = relationship("Mower", back_populates="maintenance_schedules")
    parts = relationship(
        "MaintenancePart", back_populates="schedule", cascade="all, delete-orphan"
    )


class MaintenancePart(Base):
    __tablename__ = "maintenance_parts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    maintenance_schedule_id: Mapped[int] = mapped_column(
        ForeignKey("maintenance_schedules.id", ondelete="CASCADE"), nullable=False
    )
    part_name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # e.g., "Oil Filter", "Air Filter"
    part_number: Mapped[str] = mapped_column(
        String(50), nullable=True
    )  # Manufacturer part number
    supplier: Mapped[str] = mapped_column(
        String(100), nullable=True
    )  # e.g., "Amazon", "Local Dealer"
    part_url: Mapped[str] = mapped_column(
        String(500), nullable=True
    )  # Direct link to purchase
    estimated_cost: Mapped[float] = mapped_column(
        Float, nullable=True
    )  # Estimated cost for budgeting
    notes: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    schedule = relationship("MaintenanceSchedule", back_populates="parts")


class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    mower_id: Mapped[int] = mapped_column(
        ForeignKey("mowers.id", ondelete="CASCADE"), nullable=False
    )
    maintenance_schedule_id: Mapped[int] = mapped_column(
        ForeignKey("maintenance_schedules.id"), nullable=True
    )  # Link to schedule if applicable
    maintenance_type: Mapped[MaintenanceType] = mapped_column(
        Enum(MaintenanceType), nullable=False
    )
    custom_name: Mapped[str] = mapped_column(
        String(100), nullable=True
    )  # For ad-hoc maintenance
    maintenance_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    hours_at_maintenance: Mapped[int] = mapped_column(Integer, nullable=False)
    total_cost: Mapped[float] = mapped_column(
        Float, nullable=True
    )  # Total cost including parts and labor
    labor_cost: Mapped[float] = mapped_column(
        Float, nullable=True
    )  # Labor cost if applicable
    performed_by: Mapped[str] = mapped_column(
        String(100), nullable=True
    )  # "DIY", "Dealer", "Mobile Service", etc.
    notes: Mapped[str] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    mower = relationship("Mower", back_populates="maintenance_logs")
    schedule = relationship("MaintenanceSchedule")
    parts_used = relationship(
        "MaintenanceLogPart",
        back_populates="maintenance_log",
        cascade="all, delete-orphan",
    )


class MaintenanceLogPart(Base):
    __tablename__ = "maintenance_log_parts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    maintenance_log_id: Mapped[int] = mapped_column(
        ForeignKey("maintenance_logs.id", ondelete="CASCADE"), nullable=False
    )
    part_name: Mapped[str] = mapped_column(String(100), nullable=False)
    part_number: Mapped[str] = mapped_column(String(50), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_cost: Mapped[float] = mapped_column(Float, nullable=True)
    total_cost: Mapped[float] = mapped_column(Float, nullable=True)
    supplier: Mapped[str] = mapped_column(String(100), nullable=True)
    notes: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    maintenance_log = relationship("MaintenanceLog", back_populates="parts_used")

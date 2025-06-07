from datetime import datetime
from sqlalchemy import String, DateTime, Float, Enum
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
import enum


class GrassType(enum.Enum):
    cold_season = "cold_season"
    warm_season = "warm_season"


class Lawn(Base):
    __tablename__ = "lawns"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    area: Mapped[float] = mapped_column(Float, nullable=False)
    grass_type: Mapped[GrassType] = mapped_column(Enum(GrassType), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

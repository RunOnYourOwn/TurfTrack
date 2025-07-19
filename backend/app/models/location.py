from sqlalchemy import Float, UniqueConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)

    lawns = relationship("Lawn", back_populates="location")
    weather_entries = relationship(
        "DailyWeather", back_populates="location", cascade="all, delete-orphan"
    )
    gdd_models = relationship(
        "GDDModel", back_populates="location", cascade="all, delete-orphan"
    )
    disease_pressures = relationship(
        "DiseasePressure", back_populates="location", cascade="all, delete-orphan"
    )
    weed_pressure_entries = relationship(
        "WeedPressure", back_populates="location", cascade="all, delete-orphan"
    )

    __table_args__ = (UniqueConstraint("latitude", "longitude", name="uix_lat_lon"),)

from sqlalchemy import Float, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)

    lawns = relationship("Lawn", back_populates="location")
    weather_entries = relationship("DailyWeather", back_populates="location")

    __table_args__ = (UniqueConstraint("latitude", "longitude", name="uix_lat_lon"),)

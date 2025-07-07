from sqlalchemy import Column, Integer, Float, String, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class DiseasePressure(Base):
    __tablename__ = "disease_pressure"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)
    location_id = Column(
        Integer, ForeignKey("locations.id"), nullable=False, index=True
    )
    disease = Column(String(32), nullable=False, index=True)
    risk_score = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    location = relationship("Location", back_populates="disease_pressures")

from sqlalchemy import (
    Column,
    Integer,
    Float,
    Date,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class GrowthPotential(Base):
    __tablename__ = "growth_potential"
    __table_args__ = (
        UniqueConstraint(
            "location_id", "date", name="uq_growth_potential_location_date"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)
    location_id = Column(
        Integer,
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    growth_potential = Column(Float, nullable=True)
    gp_3d_avg = Column(Float, nullable=True)
    gp_5d_avg = Column(Float, nullable=True)
    gp_7d_avg = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    location = relationship("Location")

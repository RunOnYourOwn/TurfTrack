from datetime import datetime, date
from sqlalchemy import String, Date, DateTime, Float, Integer, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum


class ApplicationStatus(enum.Enum):
    planned = "planned"
    completed = "completed"
    skipped = "skipped"


class ApplicationUnit(str, enum.Enum):
    lbs = "lbs"
    oz = "oz"
    kg = "kg"
    g = "g"
    gal = "gal"
    qt = "qt"
    pt = "pt"
    fl_oz = "fl_oz"
    L = "L"
    mL = "mL"
    bags = "bags"
    tablets = "tablets"


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lawn_id: Mapped[int] = mapped_column(ForeignKey("lawns.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    application_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount_per_area: Mapped[float] = mapped_column(Float, nullable=False)
    area_unit: Mapped[int] = mapped_column(Integer, nullable=False, default=1000)
    unit: Mapped[ApplicationUnit] = mapped_column(Enum(ApplicationUnit), nullable=False)
    notes: Mapped[str] = mapped_column(String(512), nullable=True)
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus), nullable=False, default=ApplicationStatus.planned
    )
    tied_gdd_model_id: Mapped[int | None] = mapped_column(
        ForeignKey("gdd_models.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    cost_applied: Mapped[float | None] = mapped_column(Float, nullable=True)
    n_applied: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_applied: Mapped[float | None] = mapped_column(Float, nullable=True)
    k_applied: Mapped[float | None] = mapped_column(Float, nullable=True)
    ca_applied: Mapped[float | None] = mapped_column(Float, nullable=True)
    mg_applied: Mapped[float | None] = mapped_column(Float, nullable=True)
    s_applied: Mapped[float | None] = mapped_column(Float, nullable=True)
    fe_applied: Mapped[float | None] = mapped_column(Float, nullable=True)
    cu_applied: Mapped[float | None] = mapped_column(Float, nullable=True)
    mn_applied: Mapped[float | None] = mapped_column(Float, nullable=True)
    b_applied: Mapped[float | None] = mapped_column(Float, nullable=True)
    zn_applied: Mapped[float | None] = mapped_column(Float, nullable=True)

    lawn = relationship("Lawn")
    product = relationship("Product")
    tied_gdd_model = relationship("GDDModel")

from datetime import datetime
from sqlalchemy import String, DateTime, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from sqlalchemy import Computed


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    n_pct: Mapped[float] = mapped_column(Float, default=0.0)
    p_pct: Mapped[float] = mapped_column(Float, default=0.0)
    k_pct: Mapped[float] = mapped_column(Float, default=0.0)
    ca_pct: Mapped[float] = mapped_column(Float, default=0.0)
    mg_pct: Mapped[float] = mapped_column(Float, default=0.0)
    s_pct: Mapped[float] = mapped_column(Float, default=0.0)
    fe_pct: Mapped[float] = mapped_column(Float, default=0.0)
    cu_pct: Mapped[float] = mapped_column(Float, default=0.0)
    mn_pct: Mapped[float] = mapped_column(Float, default=0.0)
    b_pct: Mapped[float] = mapped_column(Float, default=0.0)
    zn_pct: Mapped[float] = mapped_column(Float, default=0.0)
    weight_lbs: Mapped[float] = mapped_column(Float, nullable=True)
    cost_per_bag: Mapped[float | None] = mapped_column(Float, nullable=True)
    sgn: Mapped[str] = mapped_column(String(32), nullable=True)
    product_link: Mapped[str] = mapped_column(String(512), nullable=True)
    label: Mapped[str] = mapped_column(String(512), nullable=True)
    sources: Mapped[str] = mapped_column(String, nullable=True)
    urea_nitrogen: Mapped[float] = mapped_column(Float, nullable=True)
    ammoniacal_nitrogen: Mapped[float] = mapped_column(Float, nullable=True)
    water_insol_nitrogen: Mapped[float] = mapped_column(Float, nullable=True)
    other_water_soluble: Mapped[float] = mapped_column(Float, nullable=True)
    slowly_available_from: Mapped[str] = mapped_column(String(255), nullable=True)
    cost_per_lb_n: Mapped[float] = mapped_column(
        Float,
        Computed(
            "CASE WHEN n_pct IS NOT NULL AND n_pct != 0 AND weight_lbs IS NOT NULL AND weight_lbs != 0 "
            "THEN cost_per_bag / ((n_pct / 100) * weight_lbs) ELSE NULL END",
            persisted=True,
        ),
        nullable=True,
    )
    cost_per_lb: Mapped[float] = mapped_column(
        Float,
        Computed(
            "CASE WHEN weight_lbs IS NOT NULL AND weight_lbs != 0 "
            "THEN cost_per_bag / weight_lbs ELSE NULL END",
            persisted=True,
        ),
        nullable=True,
    )
    last_scraped_price: Mapped[float] = mapped_column(Float, nullable=True)
    last_scraped_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

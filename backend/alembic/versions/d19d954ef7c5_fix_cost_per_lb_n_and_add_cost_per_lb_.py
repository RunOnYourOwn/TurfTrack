"""Fix cost_per_lb_n and add cost_per_lb to products

Revision ID: d19d954ef7c5
Revises: 54ecede97689
Create Date: 2025-06-18 15:11:45.243372

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d19d954ef7c5"
down_revision: Union[str, None] = "54ecede97689"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the old cost_per_lb_n column if it exists
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS cost_per_lb_n;")
    # Add the corrected cost_per_lb_n column
    op.execute(
        """
        ALTER TABLE products
        ADD COLUMN cost_per_lb_n numeric GENERATED ALWAYS AS (
            CASE
                WHEN n_pct IS NOT NULL AND n_pct != 0 AND weight_lbs IS NOT NULL AND weight_lbs != 0
                THEN cost_per_bag / ((n_pct / 100) * weight_lbs)
                ELSE NULL
            END
        ) STORED;
        """
    )
    # Add the cost_per_lb column
    op.add_column(
        "products",
        sa.Column(
            "cost_per_lb",
            sa.Float(),
            sa.Computed(
                "CASE WHEN weight_lbs IS NOT NULL AND weight_lbs != 0 THEN cost_per_bag / weight_lbs ELSE NULL END",
                persisted=True,
            ),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("products", "cost_per_lb")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS cost_per_lb_n;")

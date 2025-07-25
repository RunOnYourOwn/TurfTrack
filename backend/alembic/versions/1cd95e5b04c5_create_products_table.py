"""create products table

Revision ID: 1cd95e5b04c5
Revises: ff074de5ddbc
Create Date: 2025-06-18 11:16:53.306701

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1cd95e5b04c5"
down_revision: Union[str, None] = "ff074de5ddbc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("n_pct", sa.Float(), nullable=False),
        sa.Column("p_pct", sa.Float(), nullable=False),
        sa.Column("k_pct", sa.Float(), nullable=False),
        sa.Column("ca_pct", sa.Float(), nullable=False),
        sa.Column("mg_pct", sa.Float(), nullable=False),
        sa.Column("s_pct", sa.Float(), nullable=False),
        sa.Column("fe_pct", sa.Float(), nullable=False),
        sa.Column("cu_pct", sa.Float(), nullable=False),
        sa.Column("mn_pct", sa.Float(), nullable=False),
        sa.Column("b_pct", sa.Float(), nullable=False),
        sa.Column("zn_pct", sa.Float(), nullable=False),
        sa.Column("weight_lbs", sa.Float(), nullable=True),
        sa.Column("cost_per_bag", sa.Float(), nullable=True),
        sa.Column(
            "cost_per_lb_n",
            sa.Float().with_variant(
                sa.dialects.postgresql.DOUBLE_PRECISION(), "postgresql"
            ),
            sa.Computed(
                "CASE WHEN weight_lbs > 0 THEN cost_per_bag / weight_lbs ELSE NULL END",
                persisted=True,
            ),
        ),
        sa.Column("sgn", sa.String(length=32), nullable=True),
        sa.Column("product_link", sa.String(length=512), nullable=True),
        sa.Column("label", sa.String(length=512), nullable=True),
        sa.Column("sources", sa.String(), nullable=True),
        sa.Column("urea_nitrogen", sa.Float(), nullable=True),
        sa.Column("ammoniacal_nitrogen", sa.Float(), nullable=True),
        sa.Column("water_insol_nitrogen", sa.Float(), nullable=True),
        sa.Column("other_water_soluble", sa.Float(), nullable=True),
        sa.Column("slowly_available_from", sa.String(length=255), nullable=True),
        sa.Column("last_scraped_price", sa.Float(), nullable=True),
        sa.Column("last_scraped_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table("products")
    # ### end Alembic commands ###

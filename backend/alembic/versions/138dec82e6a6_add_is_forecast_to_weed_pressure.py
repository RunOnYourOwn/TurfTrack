"""add_is_forecast_to_weed_pressure

Revision ID: 138dec82e6a6
Revises: 9f610484a898
Create Date: 2025-07-17 21:44:17.450855

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "138dec82e6a6"
down_revision: Union[str, None] = "9f610484a898"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_forecast column to weed_pressure table."""
    op.add_column(
        "weed_pressure",
        sa.Column("is_forecast", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    """Remove is_forecast column from weed_pressure table."""
    op.drop_column("weed_pressure", "is_forecast")

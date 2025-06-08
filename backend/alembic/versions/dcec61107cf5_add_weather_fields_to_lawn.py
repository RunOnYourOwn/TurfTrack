"""add weather fields to lawn

Revision ID: dcec61107cf5
Revises: 33f191fec956
Create Date: 2025-06-07 21:16:19.809016

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "dcec61107cf5"
down_revision: Union[str, None] = "33f191fec956"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Create the enum type first
    op.execute("""
        CREATE TYPE weatherfetchfrequency AS ENUM ('four_h', 'eight_h', 'twelve_h', 'twentyfour_h')
    """)
    # 2. Add the new columns, with server defaults for NOT NULL columns
    op.add_column(
        "lawns",
        sa.Column(
            "weather_fetch_frequency",
            sa.Enum(
                "four_h",
                "eight_h",
                "twelve_h",
                "twentyfour_h",
                name="weatherfetchfrequency",
            ),
            nullable=False,
            server_default="twentyfour_h",
        ),
    )
    op.add_column(
        "lawns",
        sa.Column(
            "timezone", sa.String(length=64), nullable=False, server_default="UTC"
        ),
    )
    op.add_column(
        "lawns",
        sa.Column(
            "weather_enabled", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop columns first, then drop the enum type
    op.drop_column("lawns", "weather_enabled")
    op.drop_column("lawns", "timezone")
    op.drop_column("lawns", "weather_fetch_frequency")
    op.execute("DROP TYPE weatherfetchfrequency")

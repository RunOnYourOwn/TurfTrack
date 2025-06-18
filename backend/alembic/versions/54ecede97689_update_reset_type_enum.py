"""update reset type enum

Revision ID: 54ecede97689
Revises: 65e4c4a7246b
Create Date: 2025-06-18 13:17:31.301777

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "54ecede97689"
down_revision: Union[str, None] = "65e4c4a7246b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.execute("ALTER TYPE resettype ADD VALUE IF NOT EXISTS 'application'")


def downgrade():
    # Downgrade is not supported for removing enum values in Postgres.
    pass

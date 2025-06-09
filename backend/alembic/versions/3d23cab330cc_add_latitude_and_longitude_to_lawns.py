"""add latitude and longitude to lawns

Revision ID: 3d23cab330cc
Revises: dcec61107cf5
Create Date: 2025-06-09 11:30:57.284898

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "3d23cab330cc"
down_revision: Union[str, None] = "dcec61107cf5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lawns", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("lawns", sa.Column("longitude", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("lawns", "latitude")
    op.drop_column("lawns", "longitude")

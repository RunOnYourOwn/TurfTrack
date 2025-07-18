"""add request_id to task_status

Revision ID: e2dd6106e27e
Revises: a31bd78fc81d
Create Date: 2025-07-14 15:51:26.672903

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2dd6106e27e'
down_revision: Union[str, None] = 'a31bd78fc81d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('task_status', sa.Column('request_id', sa.String(), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('task_status', 'request_id')
    # ### end Alembic commands ###

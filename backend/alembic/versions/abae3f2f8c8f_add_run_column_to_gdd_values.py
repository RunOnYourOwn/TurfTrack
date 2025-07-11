"""add run column to gdd_values

Revision ID: abae3f2f8c8f
Revises: 0d3880b8471c
Create Date: 2025-06-17 14:59:28.478559

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'abae3f2f8c8f'
down_revision: Union[str, None] = '0d3880b8471c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('gdd_values', sa.Column('run', sa.Integer(), nullable=False))
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('gdd_values', 'run')
    # ### end Alembic commands ###

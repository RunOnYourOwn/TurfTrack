"""add location name

Revision ID: 1a13593c9996
Revises: de664d9dd04d
Create Date: 2025-06-29 19:59:54.732555

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1a13593c9996"
down_revision: Union[str, None] = "de664d9dd04d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add the column as nullable=True
    op.add_column("locations", sa.Column("name", sa.String(length=100), nullable=True))

    # 2. Populate existing rows with unique names
    conn = op.get_bind()
    locations = conn.execute(sa.text("SELECT id FROM locations")).fetchall()
    for idx, row in enumerate(locations, start=1):
        conn.execute(
            sa.text("UPDATE locations SET name = :name WHERE id = :id"),
            {"name": f"Location {idx}", "id": row.id},
        )

    # 3. Alter the column to nullable=False
    op.alter_column("locations", "name", nullable=False)

    # 4. Add the unique constraint
    op.create_unique_constraint("uq_locations_name", "locations", ["name"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_locations_name", "locations", type_="unique")
    op.drop_column("locations", "name")

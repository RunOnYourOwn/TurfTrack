"""update_gdd_models_to_use_location_id

Revision ID: 94794423d860
Revises: 1a13593c9996
Create Date: 2025-06-29 20:42:29.951733

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "94794423d860"
down_revision: Union[str, None] = "1a13593c9996"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###

    # Step 1: Add location_id column as nullable first
    op.add_column("gdd_models", sa.Column("location_id", sa.Integer(), nullable=True))

    # Step 2: Migrate data from lawn_id to location_id
    op.execute("""
        UPDATE gdd_models 
        SET location_id = (
            SELECT location_id 
            FROM lawns 
            WHERE lawns.id = gdd_models.lawn_id
        )
    """)

    # Step 3: Make location_id not nullable
    op.alter_column("gdd_models", "location_id", nullable=False)

    # Step 4: Update constraints
    op.drop_constraint(op.f("uix_lawn_name"), "gdd_models", type_="unique")
    op.create_unique_constraint(
        "uix_location_name", "gdd_models", ["location_id", "name"]
    )
    op.drop_constraint(
        op.f("gdd_models_lawn_id_fkey"), "gdd_models", type_="foreignkey"
    )
    op.create_foreign_key(
        None, "gdd_models", "locations", ["location_id"], ["id"], ondelete="CASCADE"
    )

    # Step 5: Drop the old lawn_id column
    op.drop_column("gdd_models", "lawn_id")
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###

    # Step 1: Add lawn_id column as nullable first
    op.add_column(
        "gdd_models",
        sa.Column("lawn_id", sa.INTEGER(), autoincrement=False, nullable=True),
    )

    # Step 2: Migrate data back from location_id to lawn_id
    # Note: This assumes there's only one lawn per location, which may not be true
    # This is a limitation of the downgrade
    op.execute("""
        UPDATE gdd_models 
        SET lawn_id = (
            SELECT id 
            FROM lawns 
            WHERE lawns.location_id = gdd_models.location_id
            LIMIT 1
        )
    """)

    # Step 3: Make lawn_id not nullable
    op.alter_column("gdd_models", "lawn_id", nullable=False)

    # Step 4: Update constraints
    op.drop_constraint(None, "gdd_models", type_="foreignkey")
    op.create_foreign_key(
        op.f("gdd_models_lawn_id_fkey"),
        "gdd_models",
        "lawns",
        ["lawn_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint("uix_location_name", "gdd_models", type_="unique")
    op.create_unique_constraint(
        op.f("uix_lawn_name"),
        "gdd_models",
        ["lawn_id", "name"],
        postgresql_nulls_not_distinct=False,
    )

    # Step 5: Drop the location_id column
    op.drop_column("gdd_models", "location_id")
    # ### end Alembic commands ###

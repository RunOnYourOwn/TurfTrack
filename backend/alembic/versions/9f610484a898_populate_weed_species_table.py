"""populate_weed_species_table

Revision ID: 9f610484a898
Revises: 66e2fcb24857
Create Date: 2025-07-17 21:42:37.065381

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9f610484a898"
down_revision: Union[str, None] = "66e2fcb24857"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Populate weed species table with common turf weeds."""

    # Insert weed species data
    op.execute("""
        INSERT INTO weed_species (
            name, common_name, gdd_base_temp_c, gdd_threshold_emergence,
            optimal_soil_temp_min_c, optimal_soil_temp_max_c,
            moisture_preference, season, is_active, created_at, updated_at
        ) VALUES 
        (
            'crabgrass', 'Crabgrass', 10.0, 150.0, 15.0, 35.0,
            'medium', 'summer', true, NOW(), NOW()
        ),
        (
            'goosegrass', 'Goosegrass', 12.0, 180.0, 18.0, 32.0,
            'medium', 'summer', true, NOW(), NOW()
        ),
        (
            'broadleaf_weeds', 'Broadleaf Weeds', 8.0, 120.0, 12.0, 30.0,
            'low', 'spring', true, NOW(), NOW()
        ),
        (
            'sedges', 'Sedges', 13.0, 200.0, 20.0, 35.0,
            'high', 'summer', true, NOW(), NOW()
        ),
        (
            'annual_bluegrass', 'Annual Bluegrass', 5.0, 100.0, 10.0, 25.0,
            'high', 'fall', true, NOW(), NOW()
        )
        ON CONFLICT (name) DO NOTHING;
    """)


def downgrade() -> None:
    """Remove weed species data."""
    op.execute(
        "DELETE FROM weed_species WHERE name IN ('crabgrass', 'goosegrass', 'broadleaf_weeds', 'sedges', 'annual_bluegrass');"
    )

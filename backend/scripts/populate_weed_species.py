#!/usr/bin/env python3
"""
Script to populate the weed_species table with initial data for common turf weeds.
Run this after creating the weed_pressure tables.
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal
from app.models.weed_pressure import WeedSpecies, WeedSeason, MoisturePreference


def populate_weed_species():
    """Populate the weed_species table with common turf weeds."""

    weed_species_data = [
        {
            "name": "crabgrass",
            "common_name": "Crabgrass",
            "gdd_base_temp_c": 10.0,  # 50°F
            "gdd_threshold_emergence": 250.0,
            "optimal_soil_temp_min_c": 13.0,  # 55°F
            "optimal_soil_temp_max_c": 18.0,  # 65°F
            "moisture_preference": MoisturePreference.medium,
            "season": WeedSeason.spring,
        },
        {
            "name": "goosegrass",
            "common_name": "Goosegrass",
            "gdd_base_temp_c": 15.5,  # 60°F
            "gdd_threshold_emergence": 350.0,
            "optimal_soil_temp_min_c": 15.0,  # 60°F
            "optimal_soil_temp_max_c": 20.0,  # 68°F
            "moisture_preference": MoisturePreference.medium,
            "season": WeedSeason.summer,
        },
        {
            "name": "broadleaf_weeds",
            "common_name": "Broadleaf Weeds",
            "gdd_base_temp_c": 8.0,  # 46°F
            "gdd_threshold_emergence": 150.0,
            "optimal_soil_temp_min_c": 10.0,  # 50°F
            "optimal_soil_temp_max_c": 25.0,  # 77°F
            "moisture_preference": MoisturePreference.high,
            "season": WeedSeason.spring,
        },
        {
            "name": "sedges",
            "common_name": "Sedges",
            "gdd_base_temp_c": 12.0,  # 54°F
            "gdd_threshold_emergence": 300.0,
            "optimal_soil_temp_min_c": 15.0,  # 60°F
            "optimal_soil_temp_max_c": 25.0,  # 77°F
            "moisture_preference": MoisturePreference.high,
            "season": WeedSeason.summer,
        },
        {
            "name": "annual_bluegrass",
            "common_name": "Annual Bluegrass",
            "gdd_base_temp_c": 5.0,  # 41°F
            "gdd_threshold_emergence": 100.0,
            "optimal_soil_temp_min_c": 8.0,  # 46°F
            "optimal_soil_temp_max_c": 20.0,  # 68°F
            "moisture_preference": MoisturePreference.high,
            "season": WeedSeason.fall,
        },
    ]

    with SessionLocal() as session:
        # Check if weed species already exist
        existing_count = session.query(WeedSpecies).count()
        if existing_count > 0:
            print(f"Found {existing_count} existing weed species. Skipping population.")
            return

        # Create weed species entries
        for species_data in weed_species_data:
            species = WeedSpecies(**species_data)
            session.add(species)

        session.commit()
        print(f"Successfully populated {len(weed_species_data)} weed species:")

        for species_data in weed_species_data:
            print(f"  - {species_data['common_name']} ({species_data['name']})")


if __name__ == "__main__":
    populate_weed_species()

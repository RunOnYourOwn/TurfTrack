-- Seed weed species for weed pressure calculations
INSERT INTO weed_species (name, common_name, gdd_base_temp_c, gdd_threshold_emergence,
    optimal_soil_temp_min_c, optimal_soil_temp_max_c, moisture_preference, season, is_active)
VALUES
    ('crabgrass', 'Crabgrass', 10.0, 150.0, 15.0, 35.0, 'medium', 'summer', true),
    ('goosegrass', 'Goosegrass', 12.0, 180.0, 18.0, 32.0, 'medium', 'summer', true),
    ('broadleaf_weeds', 'Broadleaf Weeds', 8.0, 120.0, 12.0, 30.0, 'low', 'spring', true),
    ('sedges', 'Sedges', 13.0, 200.0, 20.0, 35.0, 'high', 'summer', true),
    ('annual_bluegrass', 'Annual Bluegrass', 5.0, 100.0, 10.0, 25.0, 'high', 'fall', true)
ON CONFLICT (name) DO NOTHING;

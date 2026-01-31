-- TurfTrack initial schema (ported from 36 Alembic migrations)

-- Locations
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    UNIQUE(latitude, longitude)
);

-- Lawns
CREATE TABLE IF NOT EXISTS lawns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    area DOUBLE PRECISION NOT NULL,
    grass_type VARCHAR(20) NOT NULL CHECK (grass_type IN ('cold_season', 'warm_season')),
    notes VARCHAR(500),
    weather_fetch_frequency VARCHAR(10) NOT NULL DEFAULT '24h' CHECK (weather_fetch_frequency IN ('4h', '8h', '12h', '24h')),
    timezone VARCHAR(64) NOT NULL,
    weather_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily Weather
CREATE TABLE IF NOT EXISTS daily_weather (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('historical', 'forecast')),
    temperature_max_c DOUBLE PRECISION NOT NULL,
    temperature_max_f DOUBLE PRECISION NOT NULL,
    temperature_min_c DOUBLE PRECISION NOT NULL,
    temperature_min_f DOUBLE PRECISION NOT NULL,
    precipitation_mm DOUBLE PRECISION NOT NULL,
    precipitation_in DOUBLE PRECISION NOT NULL,
    precipitation_probability_max DOUBLE PRECISION NOT NULL,
    wind_speed_max_ms DOUBLE PRECISION NOT NULL,
    wind_speed_max_mph DOUBLE PRECISION NOT NULL,
    wind_gusts_max_ms DOUBLE PRECISION NOT NULL,
    wind_gusts_max_mph DOUBLE PRECISION NOT NULL,
    wind_direction_dominant_deg DOUBLE PRECISION NOT NULL,
    et0_evapotranspiration_mm DOUBLE PRECISION NOT NULL,
    et0_evapotranspiration_in DOUBLE PRECISION NOT NULL,
    relative_humidity_mean DOUBLE PRECISION,
    relative_humidity_max DOUBLE PRECISION,
    relative_humidity_min DOUBLE PRECISION,
    dew_point_max_c DOUBLE PRECISION,
    dew_point_max_f DOUBLE PRECISION,
    dew_point_min_c DOUBLE PRECISION,
    dew_point_min_f DOUBLE PRECISION,
    dew_point_mean_c DOUBLE PRECISION,
    dew_point_mean_f DOUBLE PRECISION,
    sunshine_duration_s DOUBLE PRECISION,
    sunshine_duration_h DOUBLE PRECISION,
    UNIQUE(date, location_id, type)
);

CREATE INDEX IF NOT EXISTS idx_daily_weather_location_date ON daily_weather(location_id, date);

-- GDD Models
CREATE TABLE IF NOT EXISTS gdd_models (
    id SERIAL PRIMARY KEY,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    base_temp DOUBLE PRECISION NOT NULL,
    unit VARCHAR(5) NOT NULL CHECK (unit IN ('C', 'F')),
    start_date DATE NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    reset_on_threshold BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(location_id, name)
);

-- GDD Model Parameters History
CREATE TABLE IF NOT EXISTS gdd_model_parameters (
    id SERIAL PRIMARY KEY,
    gdd_model_id INTEGER NOT NULL REFERENCES gdd_models(id) ON DELETE CASCADE,
    base_temp DOUBLE PRECISION NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    reset_on_threshold BOOLEAN NOT NULL,
    effective_from DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(gdd_model_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_gdd_params_effective ON gdd_model_parameters(effective_from);

-- GDD Values
CREATE TABLE IF NOT EXISTS gdd_values (
    id SERIAL PRIMARY KEY,
    gdd_model_id INTEGER NOT NULL REFERENCES gdd_models(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    daily_gdd DOUBLE PRECISION NOT NULL,
    cumulative_gdd DOUBLE PRECISION NOT NULL,
    is_forecast BOOLEAN NOT NULL DEFAULT FALSE,
    run INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_gdd_values_date ON gdd_values(date);
CREATE INDEX IF NOT EXISTS idx_gdd_values_model_date ON gdd_values(gdd_model_id, date);

-- GDD Resets
CREATE TABLE IF NOT EXISTS gdd_resets (
    id SERIAL PRIMARY KEY,
    gdd_model_id INTEGER NOT NULL REFERENCES gdd_models(id) ON DELETE CASCADE,
    reset_date DATE NOT NULL,
    run_number INTEGER NOT NULL,
    reset_type VARCHAR(20) NOT NULL CHECK (reset_type IN ('manual', 'threshold', 'initial', 'application')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gdd_resets_date ON gdd_resets(reset_date);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    n_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    p_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    k_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    ca_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    mg_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    s_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    fe_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    cu_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    mn_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    b_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    zn_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    weight_lbs DOUBLE PRECISION,
    cost_per_bag DOUBLE PRECISION,
    sgn VARCHAR(32),
    product_link VARCHAR(512),
    label VARCHAR(512),
    sources TEXT,
    urea_nitrogen DOUBLE PRECISION,
    ammoniacal_nitrogen DOUBLE PRECISION,
    water_insol_nitrogen DOUBLE PRECISION,
    other_water_soluble DOUBLE PRECISION,
    slowly_available_from VARCHAR(255),
    cost_per_lb_n DOUBLE PRECISION GENERATED ALWAYS AS (
        CASE WHEN n_pct > 0 AND weight_lbs > 0 THEN cost_per_bag / ((n_pct / 100.0) * weight_lbs) ELSE NULL END
    ) STORED,
    cost_per_lb DOUBLE PRECISION GENERATED ALWAYS AS (
        CASE WHEN weight_lbs > 0 THEN cost_per_bag / weight_lbs ELSE NULL END
    ) STORED,
    last_scraped_price DOUBLE PRECISION,
    last_scraped_at TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Applications
CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    lawn_id INTEGER NOT NULL REFERENCES lawns(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    application_date DATE NOT NULL,
    amount_per_area DOUBLE PRECISION NOT NULL,
    area_unit INTEGER NOT NULL DEFAULT 1000,
    unit VARCHAR(20) NOT NULL,
    notes VARCHAR(512),
    status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'skipped')),
    tied_gdd_model_id INTEGER REFERENCES gdd_models(id) ON DELETE SET NULL,
    cost_applied DOUBLE PRECISION,
    n_applied DOUBLE PRECISION,
    p_applied DOUBLE PRECISION,
    k_applied DOUBLE PRECISION,
    ca_applied DOUBLE PRECISION,
    mg_applied DOUBLE PRECISION,
    s_applied DOUBLE PRECISION,
    fe_applied DOUBLE PRECISION,
    cu_applied DOUBLE PRECISION,
    mn_applied DOUBLE PRECISION,
    b_applied DOUBLE PRECISION,
    zn_applied DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_date ON applications(application_date);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- Disease Pressure
CREATE TABLE IF NOT EXISTS disease_pressure (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    disease VARCHAR(32) NOT NULL,
    risk_score DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disease_pressure_date ON disease_pressure(date);
CREATE INDEX IF NOT EXISTS idx_disease_pressure_location ON disease_pressure(location_id);
CREATE INDEX IF NOT EXISTS idx_disease_pressure_disease ON disease_pressure(disease);

-- Growth Potential
CREATE TABLE IF NOT EXISTS growth_potential (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    growth_potential DOUBLE PRECISION,
    gp_3d_avg DOUBLE PRECISION,
    gp_5d_avg DOUBLE PRECISION,
    gp_7d_avg DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(location_id, date)
);

CREATE INDEX IF NOT EXISTS idx_growth_potential_date ON growth_potential(date);
CREATE INDEX IF NOT EXISTS idx_growth_potential_location ON growth_potential(location_id);

-- Irrigation Entries
CREATE TABLE IF NOT EXISTS irrigation_entries (
    id SERIAL PRIMARY KEY,
    lawn_id INTEGER NOT NULL REFERENCES lawns(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    duration INTEGER NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'AUTOMATIC', 'SCHEDULED')),
    notes VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_irrigation_date ON irrigation_entries(date);

-- Weekly Water Summaries
CREATE TABLE IF NOT EXISTS weekly_water_summaries (
    id SERIAL PRIMARY KEY,
    lawn_id INTEGER NOT NULL REFERENCES lawns(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    et0_total DOUBLE PRECISION NOT NULL,
    precipitation_total DOUBLE PRECISION NOT NULL,
    irrigation_applied DOUBLE PRECISION NOT NULL,
    water_deficit DOUBLE PRECISION NOT NULL,
    status VARCHAR(20) NOT NULL,
    is_forecast BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_water_summary_week ON weekly_water_summaries(week_start);
CREATE INDEX IF NOT EXISTS idx_water_summary_lawn ON weekly_water_summaries(lawn_id);

-- Weed Species
CREATE TABLE IF NOT EXISTS weed_species (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    common_name VARCHAR(100) NOT NULL,
    gdd_base_temp_c DOUBLE PRECISION NOT NULL,
    gdd_threshold_emergence DOUBLE PRECISION NOT NULL,
    optimal_soil_temp_min_c DOUBLE PRECISION NOT NULL,
    optimal_soil_temp_max_c DOUBLE PRECISION NOT NULL,
    moisture_preference VARCHAR(20) NOT NULL CHECK (moisture_preference IN ('low', 'medium', 'high')),
    season VARCHAR(20) NOT NULL CHECK (season IN ('spring', 'summer', 'fall', 'year_round')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Weed Pressure
CREATE TABLE IF NOT EXISTS weed_pressure (
    id SERIAL PRIMARY KEY,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    weed_species_id INTEGER NOT NULL REFERENCES weed_species(id) ON DELETE CASCADE,
    weed_pressure_score DOUBLE PRECISION NOT NULL,
    gdd_risk_score DOUBLE PRECISION NOT NULL,
    soil_temp_risk_score DOUBLE PRECISION NOT NULL,
    moisture_risk_score DOUBLE PRECISION NOT NULL,
    turf_stress_score DOUBLE PRECISION NOT NULL,
    seasonal_timing_score DOUBLE PRECISION NOT NULL,
    gdd_accumulated DOUBLE PRECISION NOT NULL,
    soil_temp_estimate_c DOUBLE PRECISION NOT NULL,
    precipitation_3day_mm DOUBLE PRECISION NOT NULL,
    humidity_avg DOUBLE PRECISION NOT NULL,
    et0_mm DOUBLE PRECISION NOT NULL,
    is_forecast BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(location_id, date, weed_species_id)
);

-- Task Status
CREATE TABLE IF NOT EXISTS task_status (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(255) NOT NULL UNIQUE,
    task_name VARCHAR(255) NOT NULL,
    related_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    related_lawn_id INTEGER REFERENCES lawns(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'started', 'success', 'failure')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    result TEXT,
    error TEXT,
    request_id VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_task_status ON task_status(status);
CREATE INDEX IF NOT EXISTS idx_task_started ON task_status(started_at);

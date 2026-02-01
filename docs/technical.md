# Technical Specifications

## Technology Stack

### Application (Go)

- Go 1.24 single binary (HTTP server + background scheduler)
- net/http stdlib for routing and handlers
- html/template for server-rendered pages
- database/sql with PostgreSQL driver (lib/pq)
- HTMX for interactive form submissions and partial updates
- In-process goroutine scheduler (replaces Celery + Redis)

### UI

- DaisyUI v5 component library on Tailwind CSS 4
- ApexCharts for interactive analytics charts
- HTMX for form submissions and partial page updates
- Responsive layout with collapsible sidebar and mobile bottom dock
- Dark/light theme toggle with localStorage persistence

### Infrastructure

- PostgreSQL 16 database
- Docker (2 containers: app + postgres)
- GitHub Actions CI/CD with multi-arch builds
- GHCR for container registry
- Trivy for security scanning
- OpenMeteo API for weather data (free, no API key)

## Database Schema

All tables use integer auto-increment primary keys. Timestamps use `created_at`/`updated_at` where applicable.

### Products

- id: Integer (primary key, auto-increment)
- name: String
- type: String (fertilizer, pesticide, herbicide, etc.)
- manufacturer: String
- application_rate: Float
- unit: String
- notes: Text
- n_pct, p_pct, k_pct: Float (N-P-K percentages)
- ca_pct, mg_pct, s_pct: Float (secondary nutrients)
- fe_pct, cu_pct, mn_pct, b_pct, zn_pct: Float (micronutrients)
- weight_lbs: Float
- cost_per_bag: Float
- cost_per_lb_n: Float (calculated)
- sgn: Integer (Size Guide Number)
- product_link: String (URL)
- label: String
- sources: Text
- urea_nitrogen, ammoniacal_nitrogen, water_insol_nitrogen: Float
- created_at, updated_at: Timestamp

### Locations

- id: Integer (primary key, auto-increment)
- latitude, longitude: Float
- name: String (optional)

### Lawns

- id: Integer (primary key, auto-increment)
- name: String
- area: Float
- grass_type: String (cool_season, warm_season)
- location_id: Integer (foreign key -> locations)
- timezone: String (IANA timezone)
- created_at, updated_at: Timestamp

### Applications

- id: Integer (primary key, auto-increment)
- lawn_id: Integer (foreign key -> lawns)
- product_id: Integer (foreign key -> products)
- application_date: Date
- amount_per_area: Float
- area_unit: Float (sq ft applied to)
- unit: String (lbs, oz, gal, etc.)
- status: String (planned, completed, cancelled)
- notes: Text
- n_applied, p_applied, k_applied: Float (calculated nutrient amounts)
- cost: Float (calculated)
- created_at, updated_at: Timestamp

### Daily Weather

- id: Integer (primary key, auto-increment)
- location_id: Integer (foreign key -> locations)
- date: Date
- type: String (historical, forecast)
- temperature_max_c, temperature_min_c: Float
- precipitation_mm: Float
- relative_humidity_mean: Float
- wind_speed_10m_max, wind_gusts_10m_max: Float
- wind_direction_10m_dominant: Float
- et0_fao_evapotranspiration: Float
- relative_humidity_2m_max, relative_humidity_2m_min: Float
- dew_point_2m_max, dew_point_2m_min, dew_point_2m_mean: Float
- sunshine_duration: Float
- Unique constraint on (date, location_id, type)

### GDD Models

- id: Integer (primary key, auto-increment)
- location_id: Integer (foreign key -> locations)
- name: String
- base_temp: Float (in configured unit)
- unit: String (C or F)
- start_date: Date
- threshold: Float
- created_at, updated_at: Timestamp

### GDD Values

- id: Integer (primary key, auto-increment)
- gdd_model_id: Integer (foreign key -> gdd_models)
- date: Date
- daily_gdd: Float
- cumulative_gdd: Float
- is_forecast: Boolean
- run: Integer (accumulation period tracker)

### GDD Resets

- id: Integer (primary key, auto-increment)
- gdd_model_id: Integer (foreign key -> gdd_models)
- reset_date: Date
- reset_type: String (manual, threshold)
- pre_reset_value: Float
- notes: Text
- created_at: Timestamp

### Weed Species

- id: Integer (primary key, auto-increment)
- name: String (scientific name slug)
- common_name: String
- gdd_base_temp_c: Float
- gdd_threshold_emergence: Float
- optimal_soil_temp_min_c, optimal_soil_temp_max_c: Float
- moisture_preference: String (low, medium, high)
- season: String (spring, summer, fall, year_round)
- is_active: Boolean
- created_at, updated_at: Timestamp

### Weed Pressure

- id: Integer (primary key, auto-increment)
- location_id: Integer (foreign key -> locations)
- weed_species_id: Integer (foreign key -> weed_species)
- date: Date
- weed_pressure_score: Float (0-10)
- gdd_risk_score, soil_temp_risk_score, moisture_risk_score: Float
- turf_stress_score, seasonal_timing_score: Float
- gdd_accumulated, soil_temp_estimate_c: Float
- precipitation_3day_mm, humidity_avg, et0_mm: Float
- is_forecast: Boolean
- created_at, updated_at: Timestamp

### Disease Pressure

- id: Integer (primary key, auto-increment)
- location_id: Integer (foreign key -> locations)
- date: Date
- disease: String (e.g., "dollar_spot")
- risk_score: Float (0-1)
- avg_temp_5d, avg_humidity_5d: Float
- is_forecast: Boolean
- created_at, updated_at: Timestamp

### Growth Potential

- id: Integer (primary key, auto-increment)
- location_id: Integer (foreign key -> locations)
- date: Date
- growth_potential: Float (0-1)
- gp_3d_avg, gp_5d_avg, gp_7d_avg: Float
- created_at, updated_at: Timestamp

### Weekly Water Summaries

- id: Integer (primary key, auto-increment)
- lawn_id: Integer (foreign key -> lawns)
- week_start, week_end: Date
- et0_total, precipitation_total, irrigation_applied: Float
- water_deficit: Float
- status: String (adequate, deficit, critical, surplus)
- is_forecast: Boolean

### Irrigation Entries

- id: Integer (primary key, auto-increment)
- lawn_id: Integer (foreign key -> lawns)
- date: Date
- amount: Float (inches)
- duration: Integer (minutes)
- source: String (manual, sprinkler, etc.)
- notes: Text
- created_at, updated_at: Timestamp

### Task Status

- id: Integer (primary key, auto-increment)
- task_name: String
- related_location_id: Integer (optional)
- status: String (running, success, failure)
- started_at, finished_at: Timestamp
- error: Text
- created_at: Timestamp

### App Settings

- id: Integer (primary key, auto-increment)
- key: String (unique)
- value: Text

## Calculation Methodologies

### GDD (Growing Degree Days)

#### Daily Calculation

```
GDD = max(0, ((Tmax + Tmin) / 2) - Base Temperature)
```

Where:
- Tmax = Maximum daily temperature
- Tmin = Minimum daily temperature
- Base Temperature = User-defined (typically 0C for cool season, 10C for warm season)

#### Cumulative Tracking

- Accumulated from model start date
- Reset handling for manual and threshold-based resets
- Run-based tracking for multiple accumulation periods

#### Reset Logic

- **Manual Resets**: User-specified date, new run starts with cumulative = 0
- **Threshold Resets**: Automatic when threshold is crossed, new run starts next day
- **Run Management**: Each reset creates a new run number for tracking

### Weed Pressure

#### Multi-Factor Model

Final score (0-10) calculated as weighted sum of 5 factors:

```
Final Score = (GDD Risk * 1.36) + (Soil Temp Risk * 0.91) + (Moisture Risk * 0.91) + (Turf Stress * 0.91) + (Seasonal Timing * 0.45)
```

#### GDD Risk (0-3 points)

- **< 70% of emergence threshold**: 0 points (too early)
- **70-100% of threshold**: 1 point (approaching)
- **100-130% of threshold**: 2 points (peak emergence window)
- **> 130% of threshold**: 3 points (past peak, but still risk)

#### Soil Temperature Risk (0-2 points)

- **Estimation**: `Soil Temp = Air Temp * Seasonal Factor`
  - Spring: 0.8 (soil cooler than air)
  - Summer: 0.9 (soil closer to air temp)
  - Fall/Winter: 0.85 (intermediate)
- **Scoring**:
  - `< optimal min`: 0 points (too cold)
  - `optimal range`: 2 points (perfect conditions)
  - `optimal + 5C`: 1 point (still acceptable)
  - `> optimal + 5C`: 0 points (too hot)

#### Moisture Risk (0-2 points)

- **Precipitation (0-1 point)**: 3-day total
  - `> 25mm (1 inch)`: 1 point
  - `12-25mm (0.5-1 inch)`: 0.5 points
  - `< 12mm`: 0 points
- **Humidity (0-1 point)**: 7-day average
  - `> 80%`: 1 point
  - `70-80%`: 0.5 points
  - `< 70%`: 0 points

#### Turf Stress (0-2 points)

- **Drought Stress**: `ET0 - precipitation`
  - `> 5mm/day`: 1 point (high stress)
- **Growth Potential**: Simplified temperature-based estimate
  - `< 30%`: 1 point (low growth = stressed turf)

#### Seasonal Timing (0-1 point)

- **Spring weeds (Mar-May)**: 1 point in spring, 0 otherwise
- **Summer weeds (Jun-Aug)**: 1 point in summer, 0 otherwise
- **Fall weeds (Sep-Nov)**: 1 point in fall, 0 otherwise
- **Year-round weeds**: Always 1 point

### Disease Pressure (Smith-Kerns Model)

#### Model Formula

```
logit = b0 + b1*avg_temp + b2*avg_rh
risk_score = exp(logit) / (1 + exp(logit))
```

#### Coefficients

- b0 = -11.4041
- b1 = 0.1932 (temperature coefficient)
- b2 = 0.0894 (humidity coefficient)

#### Calculation Process

1. **5-Day Moving Averages**: Calculate average temperature and humidity over 5 days
2. **Temperature Validation**: Only calculate if avg_temp is between 10-35C
3. **Risk Scoring**: Probability-based risk assessment (0-1 scale)

### Growth Potential

#### Temperature-Based Model

```
GP = exp(-0.5 * ((temp - t_opt) / sigma)^2)
```

#### Grass Type Parameters

- **Cool Season**: t_opt = 20C, sigma = 5.5
- **Warm Season**: t_opt = 31C, sigma = 7.0

#### Rolling Averages

- **3-day average**: Smoothing for short-term trends
- **5-day average**: Medium-term trend analysis
- **7-day average**: Long-term trend analysis

### Water Balance

#### Weekly ET0 vs Precipitation vs Irrigation

- ET0 (reference evapotranspiration) from OpenMeteo
- Precipitation totals from weather data
- Irrigation from manual user entries
- Deficit = ET0 - (Precipitation + Irrigation)
- Status: adequate (deficit <= 0), deficit (0 < deficit < threshold), critical (deficit >= threshold)

## Routes

### Server-Rendered Pages (HTML)

- `GET /` - Dashboard with charts
- `GET /lawns` - Lawns list page
- `POST /lawns` - Create lawn
- `POST /lawns/{id}` - Update lawn
- `DELETE /lawns/{id}` - Delete lawn
- `GET /products` - Products list page
- `POST /products` - Create product
- `POST /products/{id}` - Update product
- `DELETE /products/{id}` - Delete product
- `GET /applications` - Applications list page
- `POST /applications` - Create application
- `POST /applications/{id}` - Update application
- `DELETE /applications/{id}` - Delete application
- `GET /gdd` - GDD models page
- `POST /gdd-models` - Create GDD model
- `PUT /gdd-models/{id}` - Update GDD model
- `DELETE /gdd-models/{id}` - Delete GDD model
- `POST /gdd-models/{id}/reset` - Manual GDD reset
- `GET /water` - Water management page
- `POST /irrigation` - Create irrigation entry
- `DELETE /irrigation/{id}` - Delete irrigation entry
- `GET /reports` - Reports page
- `GET /admin` - Admin/settings page
- `POST /admin/settings` - Update settings
- `POST /admin/run-task` - Trigger manual task run

### JSON API Endpoints (Chart Data)

- `GET /api/weather/{locationID}` - Weather chart data
- `GET /api/disease/{locationID}` - Disease pressure chart data
- `GET /api/gdd-values/{modelID}` - GDD values chart data
- `GET /api/growth-potential/{locationID}` - Growth potential chart data
- `GET /api/weed-pressure/{locationID}` - Weed pressure chart data
- `GET /api/water-summary/{lawnID}` - Water summary chart data

### System Endpoints

- `GET /health` - Health check (returns DB connectivity status)
- `GET /api/v1/version` - Version info (version, environment, go_version)

## Background Scheduler

The in-process goroutine scheduler replaces the previous Celery + Redis + Beat stack.

### Startup Run

- Fetches 60 days of weather data for all locations
- Runs all calculation engines (GDD, disease, growth potential, weed pressure, water)
- Configurable backfill depth via `BACKFILL_DAYS` env var

### Daily Recurring

- Configurable hour and timezone via app settings (admin page)
- Optimized 2-day fetch window for daily updates
- Runs all calculations after weather update

### On-Demand

- Triggered when creating new lawns/locations
- Fetches weather and runs calculations for the new location

### Task Tracking

- Records status (running, success, failure) in `task_status` table
- Visible on admin page with timestamps and error messages

## Performance Considerations

### Database

- UPSERT operations for idempotent weather and calculation storage
- Parameterized queries via database/sql (prevents SQL injection)
- CASCADE deletes for referential integrity cleanup
- Indexes on date fields and foreign keys

### Calculation Efficiency

- Batch processing for date range calculations
- Incremental updates (2-day window for daily runs vs 60-day for startup)
- All calculations run in-process (no serialization overhead)

## Security

- Non-root container execution
- Parameterized SQL queries (no string interpolation)
- Server-rendered HTML with Go template auto-escaping
- Security headers (X-Content-Type-Options, X-Frame-Options)
- Trivy image scanning in CI/CD pipeline
- No external secrets required (OpenMeteo is free, no API key)

# Technical Specifications

## Technology Stack

### Frontend

- React with TypeScript
- Vite for build tooling
- shadcn/ui for component library
- React Query for data fetching and caching
- Axios for all API requests (replacing fetch)
- React Router for navigation
- Nivo for analytics visualization
- date-fns for date handling

### Backend

- FastAPI for REST API
- PostgreSQL for primary database
- Celery with Redis for task processing
- Alembic for database migrations
- OpenMeteo API for weather data
- SQLAlchemy for ORM
- Pydantic for data validation

## Database Schema

### Products

- id: UUID (primary key)
- name: String
- type: Enum (fertilizer, pesticide, herbicide, etc.)
- manufacturer: String
- application_rate: Float
- unit: String
- notes: Text
- n_pct: Float (Nitrogen %)
- p_pct: Float (Phosphorus %)
- k_pct: Float (Potassium %)
- ca_pct: Float (Calcium %)
- mg_pct: Float (Magnesium %)
- s_pct: Float (Sulfur %)
- fe_pct: Float (Iron %)
- cu_pct: Float (Copper %)
- mn_pct: Float (Manganese %)
- b_pct: Float (Boron %)
- zn_pct: Float (Zinc %)
- weight_lbs: Float
- cost_per_bag: Float
- cost_per_lb_n: Float
- sgn: Integer (Size Guide Number)
- product_link: String (URL)
- label: String
- sources: String or JSONB (list of sources)
- urea_nitrogen: Float
- ammoniacal_nitrogen: Float
- water_insol_nitrogen: Float
- created_at: DateTime
- updated_at: DateTime

### Lawns

- id: UUID (primary key)
- name: String
- area: Float
- grass_type: Enum (cold_season, warm_season)
- location_id: ForeignKey to Location
- created_at: DateTime
- updated_at: DateTime
- weather_fetch_frequency: Enum (4h, 8h, 12h, 24h)
- timezone: String (IANA timezone)
- weather_enabled: Boolean

### Locations

- id: UUID (primary key)
- latitude: Float
- longitude: Float
- name: String (optional)

### Applications

- id: UUID (primary key)
- lawn_id: UUID (foreign key)
- product_id: UUID (foreign key)
- application_date: DateTime
- amount: Float
- notes: Text
- weather_conditions: JSONB
- status: Enum (planned, applied, cancelled)
- unit: Enum (lbs, oz, gal, etc.)
- created_at: DateTime
- updated_at: DateTime

### Weather Data

- id: UUID (primary key)
- location_id: ForeignKey to Location
- date: DateTime
- type: Enum (historical, forecast)
- temperature_max_c/f: Float
- temperature_min_c/f: Float
- precipitation_mm/in: Float
- relative_humidity_mean: Float
- wind_speed_10m_max: Float
- wind_gusts_10m_max: Float
- wind_direction_10m_dominant: Float
- et0_fao_evapotranspiration: Float
- relative_humidity_2m_max: Float
- relative_humidity_2m_min: Float
- dew_point_2m_max: Float
- dew_point_2m_min: Float
- dew_point_2m_mean: Float
- sunshine_duration: Float
- created_at: DateTime
- Unique constraint on (date, location_id, type)

### GDD Models

- id: UUID (primary key)
- location_id: UUID (foreign key)
- name: String (user-defined)
- base_temp_c: Float
- unit: Enum (C/F)
- start_date: DateTime
- threshold: Float
- reset_on_threshold: Boolean
- created_at: DateTime
- updated_at: DateTime

### GDD Values

- id: UUID (primary key)
- gdd_model_id: UUID (foreign key)
- date: DateTime
- daily_gdd: Float
- cumulative_gdd: Float
- is_forecast: Boolean
- run: Integer (tracks different GDD accumulation periods)

### GDD Resets

- id: UUID (primary key)
- gdd_model_id: UUID (foreign key)
- reset_date: DateTime
- reset_type: Enum (manual, threshold)
- reset_value: Float
- notes: Text
- created_at: DateTime

### Weed Species

- id: UUID (primary key)
- name: String
- scientific_name: String
- gdd_base_temp_c: Float
- gdd_threshold_emergence: Float
- optimal_soil_temp_min_c: Float
- optimal_soil_temp_max_c: Float
- season: Enum (spring, summer, fall, year_round)
- moisture_preference: Enum (low, medium, high)
- is_active: Boolean
- created_at: DateTime
- updated_at: DateTime

### Weed Pressure

- id: UUID (primary key)
- location_id: UUID (foreign key)
- weed_species_id: UUID (foreign key)
- date: DateTime
- weed_pressure_score: Float (0-10)
- gdd_risk_score: Float (0-3)
- soil_temp_risk_score: Float (0-2)
- moisture_risk_score: Float (0-2)
- turf_stress_score: Float (0-2)
- seasonal_timing_score: Float (0-1)
- gdd_accumulated: Float
- soil_temp_estimate_c: Float
- precipitation_3day_mm: Float
- humidity_avg: Float
- et0_mm: Float
- is_forecast: Boolean
- created_at: DateTime
- updated_at: DateTime

### Disease Pressure

- id: UUID (primary key)
- location_id: UUID (foreign key)
- date: DateTime
- disease: String (e.g., "dollar_spot")
- risk_score: Float (0-1)
- avg_temp_5d: Float
- avg_humidity_5d: Float
- is_forecast: Boolean
- created_at: DateTime
- updated_at: DateTime

### Growth Potential

- id: UUID (primary key)
- location_id: UUID (foreign key)
- date: DateTime
- growth_potential: Float (0-1)
- gp_3d_avg: Float
- gp_5d_avg: Float
- gp_7d_avg: Float
- created_at: DateTime
- updated_at: DateTime

### Task Status

- id: UUID (primary key)
- task_id: String (Celery task ID)
- task_name: String
- related_location_id: Integer (optional)
- status: Enum (pending, started, success, failure)
- started_at: DateTime
- finished_at: DateTime
- error: Text
- result: Text
- request_id: String (for request correlation)
- created_at: DateTime

## Calculation Methodologies

### GDD (Growing Degree Days)

#### Daily Calculation

```
GDD = ((Tmax + Tmin) / 2) - Base Temperature
```

Where:

- Tmax = Maximum daily temperature
- Tmin = Minimum daily temperature
- Base Temperature = User-defined base temperature (typically 0°C for cool season, 10°C for warm season)

#### Cumulative Tracking

- Accumulated from January 1st of each year
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
Final Score = (GDD Risk × 1.36) + (Soil Temp Risk × 0.91) + (Moisture Risk × 0.91) + (Turf Stress × 0.91) + (Seasonal Timing × 0.45)
```

#### GDD Risk (0-3 points)

- **< 70% of emergence threshold**: 0 points (too early)
- **70-100% of threshold**: 1 point (approaching)
- **100-130% of threshold**: 2 points (peak emergence window)
- **> 130% of threshold**: 3 points (past peak, but still risk)

#### Soil Temperature Risk (0-2 points)

- **Estimation**: `Soil Temp = Air Temp × Seasonal Factor`
  - Spring: 0.8 (soil cooler than air)
  - Summer: 0.9 (soil closer to air temp)
  - Fall/Winter: 0.85 (intermediate)
- **Scoring**:
  - `< optimal min`: 0 points (too cold)
  - `optimal range`: 2 points (perfect conditions)
  - `optimal + 5°C`: 1 point (still acceptable)
  - `> optimal + 5°C`: 0 points (too hot)

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
2. **Temperature Validation**: Only calculate if avg_temp is between 10-35°C
3. **Risk Scoring**: Probability-based risk assessment (0-1 scale)

### Growth Potential

#### Temperature-Based Model

```
GP = exp(-0.5 * ((temp - t_opt) / sigma)²)
```

#### Grass Type Parameters

- **Cold Season**: t_opt = 20°C, sigma = 5.5
- **Warm Season**: t_opt = 31°C, sigma = 7.0

#### Rolling Averages

- **3-day average**: Smoothing for short-term trends
- **5-day average**: Medium-term trend analysis
- **7-day average**: Long-term trend analysis

## API Endpoints

### Products

- GET /api/v1/products - List all products
- POST /api/v1/products - Create new product
- GET /api/v1/products/{id} - Get product details
- PUT /api/v1/products/{id} - Update product
- DELETE /api/v1/products/{id} - Delete product

### Lawns

- GET /api/v1/lawns - List all lawns
- POST /api/v1/lawns - Create new lawn (triggers weather fetch and weed pressure calculation)
- GET /api/v1/lawns/{id} - Get lawn details
- PUT /api/v1/lawns/{id} - Update lawn
- DELETE /api/v1/lawns/{id} - Delete lawn

### Applications

- GET /api/v1/applications - List all applications
- POST /api/v1/applications - Create new application
- GET /api/v1/applications/{id} - Get application details
- PUT /api/v1/applications/{id} - Update application
- DELETE /api/v1/applications/{id} - Delete application

### GDD

- GET /api/v1/gdd_models - List GDD models
- POST /api/v1/gdd_models - Create GDD model
- GET /api/v1/gdd_models/{id} - Get GDD model details
- PUT /api/v1/gdd_models/{id} - Update GDD model
- DELETE /api/v1/gdd_models/{id} - Delete GDD model
- GET /api/v1/gdd_models/{id}/values - Get GDD values for model
- POST /api/v1/gdd_models/{id}/reset - Manual reset
- GET /api/v1/gdd_models/location/{location_id} - Get models by location

### Weed Pressure

- GET /api/v1/weed_pressure - Get weed pressure data
- GET /api/v1/weed_pressure/location/{location_id} - Get by location
- GET /api/v1/weed_species - List weed species
- POST /api/v1/weed_species - Create weed species
- PUT /api/v1/weed_species/{id} - Update weed species

### Disease Pressure

- GET /api/v1/disease_pressure - Get disease pressure data
- GET /api/v1/disease_pressure/location/{location_id} - Get by location

### Growth Potential

- GET /api/v1/growth_potential - Get growth potential data
- GET /api/v1/growth_potential/location/{location_id} - Get by location

### Weather

- GET /api/v1/weather - Get weather data
- GET /api/v1/weather/location/{location_id} - Get by location

### Task Status

- GET /api/v1/task_status - List task statuses
- GET /api/v1/task_status/{task_id} - Get specific task status

### Data Health

- GET /api/v1/data_health - System health check
- GET /api/v1/data_health/location/{location_id} - Location-specific health

## Background Tasks

### Scheduled Tasks

- **Daily Weather Updates**: 3am Central time, updates all locations
- **GDD Recalculation**: Triggered after weather updates
- **Weed Pressure Calculation**: Triggered after weather updates
- **Disease Pressure Calculation**: Triggered after weather updates
- **Growth Potential Calculation**: Triggered after weather updates

### On-Demand Tasks

- **Weather Backfill**: Historical data retrieval for date ranges
- **GDD Backfill**: Recalculate GDD for specific models
- **Weed Pressure Backfill**: Recalculate weed pressure for date ranges
- **Disease Pressure Backfill**: Recalculate disease pressure for date ranges
- **Growth Potential Backfill**: Recalculate growth potential for date ranges

## Performance Considerations

### Database Optimization

- **Indexes**: Comprehensive indexing on date fields and foreign keys
- **Query Optimization**: N+1 query prevention with proper joins
- **Atomic Operations**: Race condition prevention in concurrent updates
- **Connection Pooling**: Efficient database connection management

### Caching Strategy

- **Frontend**: React Query for API response caching
- **Backend**: Redis for session storage and task broker
- **Weather Data**: Location-based deduplication prevents duplicate API calls

### Calculation Performance

- **Batch Processing**: Date range calculations for efficiency
- **Incremental Updates**: Only recalculate when weather data changes
- **Background Processing**: Heavy calculations moved to Celery workers
- **Performance Monitoring**: Comprehensive logging and metrics

## Security Considerations

### Container Security

- **Non-Root Users**: All containers run as non-root users (UID 1001-1004)
- **File Permissions**: Proper directory ownership and permissions
- **Network Security**: Container isolation and secure communication

### API Security

- **Input Validation**: Comprehensive Pydantic schema validation
- **Rate Limiting**: API rate limiting for external services
- **Data Sanitization**: Input sanitization and SQL injection prevention
- **Error Handling**: Secure error messages without information leakage

### Data Security

- **Database Security**: Connection encryption and access controls
- **Backup Procedures**: Regular automated backups
- **Audit Trail**: Comprehensive logging of all operations

## Observability

### Logging

- **Centralized Logging**: Loki, Promtail, Grafana stack
- **Request Tracing**: End-to-end request ID correlation
- **Structured Logging**: JSON-formatted logs with metadata
- **Performance Metrics**: API response times and calculation durations

### Monitoring

- **Task Monitoring**: Real-time Celery task status tracking
- **Health Checks**: Comprehensive system health monitoring
- **Error Tracking**: Error aggregation and alerting
- **Performance Dashboards**: Real-time system performance metrics

### Debugging

- **Full-Stack Tracing**: Request ID propagation from API to Celery
- **Log Search**: Grafana-based log search and filtering
- **Task Correlation**: Link API requests to background tasks
- **Error Context**: Comprehensive error context and stack traces

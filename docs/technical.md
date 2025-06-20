# Technical Specifications

## Technology Stack

### Frontend

- React with TypeScript
- Vite for build tooling
- shadcn/ui for component library
- React Query for data fetching
- Axios for all API requests (replacing fetch)
- React Router for navigation
- Chart.js for analytics visualization

### Backend

- FastAPI for REST API
- PostgreSQL for primary database
- Celery with Redis for task processing
- Alembic for database migrations
- OpenMeteo API for weather data

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

### Applications

- id: UUID (primary key)
- lawn_id: UUID (foreign key)
- product_id: UUID (foreign key)
- application_date: DateTime
- amount: Float
- notes: Text
- weather_conditions: JSONB
- created_at: DateTime
- updated_at: DateTime

### Weather Data

- id: UUID (primary key)
- location_id: ForeignKey to Location
- date: DateTime
- type: Enum (historical, forecast)
- temperature_max_c/f, temperature_min_c/f: Float
- precipitation_mm/in: Float
- humidity: Float
- wind_speed: Float
- created_at: DateTime
- Unique constraint on (date, location_id, type)

### GDD Models (MVP Complete)

- id: UUID (primary key)
- lawn_id: UUID (foreign key)
- name: String (user-defined)
- base_temp: Float
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

#### GDD Calculation Logic

- On model create/update, backend calculates and stores all GDD values (historical + forecast) for the model using location weather data.
- Daily GDD = ((Tmax + Tmin) / 2) - base_temp, where base_temp is user-defined
- Cumulative GDD is tracked per run, resetting to 0 at the start of each new run
- Runs can be created by:
  - Initial model creation (Run 1)
  - Manual reset (creates new run starting on specified date)
  - Threshold reset (if enabled, creates new run when threshold is crossed)
- Reset handling:
  - Manual resets: New run starts on the specified date with cumulative = 0
  - Threshold resets: New run starts the day after threshold is crossed
  - All resets maintain the daily_gdd values while resetting cumulative tracking
- Supports recalculation on any parameter change
- GDD data is deleted when a lawn is deleted and it's the last lawn for a location.

#### API Endpoints

- CRUD for GDD models
- Manual reset endpoint
- Fetch GDD values by run
- Fetch reset history
- Parameter update endpoint with recalculation option
- (Planned) GDD models API will return 'lawn_name' and 'next_threshold_date' for each model

#### Frontend/UX

- UI for GDD model management (create, edit, delete, per lawn)
- Manual reset controls with date selection
- Run-based visualization with run selection
- Graph shows:
  - Cumulative GDD line (resets properly with runs)
  - Daily GDD bars
  - Threshold line
  - Forecast data in different color
- Professional, modern look matching current palette
- Export functionality (CSV, PDF, etc.) is a future enhancement

## MVP Status

- GDD models, analytics, weather sync, and task monitoring are complete and robust
- System is production-ready; future enhancements are documented in tasks and technical docs

## API Endpoints

### Products

- GET /api/products - List all products
- POST /api/products - Create new product
- GET /api/products/{id} - Get product details
- PUT /api/products/{id} - Update product
- DELETE /api/products/{id} - Delete product

### Lawns

- GET /api/lawns - List all lawns
- POST /api/lawns - Create new lawn (triggers weather fetch only if no data exists for location)
- GET /api/lawns/{id} - Get lawn details
- PUT /api/lawns/{id} - Update lawn
- DELETE /api/lawns/{id} - Delete lawn

### Applications

- GET /api/applications - List all applications
- POST /api/applications - Create new application
- GET /api/applications/{id} - Get application details
- PUT /api/applications/{id} - Update application
- DELETE /api/applications/{id} - Delete application

### GDD

- GET /api/gdd/{lawn_id} - Get current GDD for lawn
- GET /api/gdd/{lawn_id}/history - Get GDD history
- GET /api/gdd/{lawn_id}/predictions - Get GDD predictions

### Weather

- Weather data is fetched and upserted per unique location
- No duplicate fetches for same location
- Scheduled Celery Beat task updates all locations daily at 3am Central (09:00 UTC)
- Atomic upsert operations prevent race conditions
- Proper error handling and task status tracking

## GDD Calculation Methodology

### Base Temperature

- Cold Season Grass: 0°C (32°F)
- Warm Season Grass: 10°C (50°F)

### Calculation Formula

```
GDD = ((Tmax + Tmin) / 2) - Tbase
```

Where:

- Tmax = Maximum daily temperature
- Tmin = Minimum daily temperature
- Tbase = Base temperature for grass type

### Weather Data Integration

- Daily weather data from OpenMeteo API
- Historical data storage for analysis
- Predictive modeling for future GDD calculations
- Atomic upsert operations for data consistency
- Race condition prevention in concurrent updates

## Task Processing

### Scheduled Tasks

- Daily weather data collection
- GDD calculations
- Application reminders
- Report generation

### Background Tasks

- Weather data processing
- GDD model updates
- Analytics calculations
- Task status tracking and monitoring

## Security Considerations

- Input validation for all API endpoints
- Rate limiting for external API calls
- Data validation for weather data
- Secure storage of application records

## Performance Considerations

- Caching of weather data
- Optimized GDD calculations
- Efficient database queries
- Background processing for heavy computations
- Atomic database operations for data consistency

## Data Fetching and API Integration

- All frontend API requests are now handled via Axios, using a generic fetcher utility in `src/lib/fetcher.ts`
- React Query is used for caching, background updates, and UI state management
- Lawns CRUD UI is fully integrated with the backend, supporting create, read, update, and delete operations via Axios and React Query

## Weather Data Deduplication & Scheduling

- When a lawn is created, backend checks if weather data exists for the location before fetching
- Weather data is stored per location, not per lawn
- Celery Beat runs a daily job to update the latest historical and forecast data for all locations
- Logging is in place to track deduplication and fetch logic
- Atomic upsert operations prevent race conditions
- Task status tracking provides visibility into update operations

## Frontend Integration

- React Query and Axios handle all CRUD and weather data fetching
- UI is built with shadcn/ui components
- Weather data is displayed per lawn, but deduplicated at the backend
- Task status tracking is ready for frontend integration

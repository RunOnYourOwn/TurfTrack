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
- location: Geography (PostGIS)
- created_at: DateTime
- updated_at: DateTime

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
- location: Geography (PostGIS)
- date: DateTime
- temperature: JSONB (min, max, avg)
- precipitation: Float
- humidity: Float
- wind_speed: Float
- created_at: DateTime

### GDD Models

- id: UUID (primary key)
- lawn_id: UUID (foreign key)
- base_temp: Float
- upper_temp: Float
- start_date: DateTime
- current_gdd: Float
- predicted_gdd: JSONB
- created_at: DateTime
- updated_at: DateTime

## API Endpoints

### Products

- GET /api/products - List all products
- POST /api/products - Create new product
- GET /api/products/{id} - Get product details
- PUT /api/products/{id} - Update product
- DELETE /api/products/{id} - Delete product

### Lawns

- GET /api/lawns - List all lawns
- POST /api/lawns - Create new lawn
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

## Data Fetching and API Integration

- All frontend API requests are now handled via Axios, using a generic fetcher utility in `src/lib/fetcher.ts`.
- React Query is used for caching, background updates, and UI state management.
- Lawns CRUD UI is fully integrated with the backend, supporting create, read, update, and delete operations via Axios and React Query.

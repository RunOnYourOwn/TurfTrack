# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Daily Water Breakdown Feature**: Added interactive daily water analysis for weekly summaries
  - Clickable weekly water history entries that open detailed daily breakdown modal
  - Daily bar chart showing ET0, precipitation, and irrigation data for each day of the week
  - Daily details table with water deficit calculations and status indicators
  - Forecast data indicators for future weeks
  - Uses existing weather and irrigation API endpoints for data consistency
  - Responsive design with proper dark/light mode support
  - Clean number formatting (2 decimal places) for improved readability
  - Optimized modal layout with proper spacing and non-overlapping elements
  - Color-coded chart with intuitive legend (Red for ET0, Blue for Precipitation, Light Blue for Irrigation)
  - Proper date parsing to ensure Monday-Sunday week display consistency

### Fixed

- **Date Picker Rendering Issue**: Fixed react-date-range calendar display across all pages

  - Added missing CSS imports to DateRangePopover component for proper calendar rendering
  - Resolved concatenated day numbers issue in date picker calendar cells
  - Centralized CSS imports in DateRangePopover component to ensure consistent styling
  - Fixed date picker functionality on Dashboard (Disease Pressure, Growth Potential, Weed Pressure), Weather Summary, and other pages using DateRangePopover

- **Water Management Week Display**: Fixed week date range display to match database format
  - Updated WeeklyWaterHistory component to show full date range (Monday to Sunday) instead of "Week of"
  - Changed display format from "Week of 6/16/2025" to "Jun 16 - Jun 22, 2025" for clarity
  - Ensured frontend display matches backend database week calculation (Monday-Sunday)
  - Added proper date formatting using date-fns for consistent display across all browsers
  - Removed debug text from weekly water history for cleaner interface
  - Fixed Daily Water Breakdown modal header layout to prevent forecast badge overlap with close button
  - Improved X-axis date label readability in daily breakdown chart with proper rotation and spacing

### Changed

## [0.0.21] - 2025-08-11

### Added

- **Complete Water Management System**:
  - Database models for `IrrigationEntry` and `WeeklyWaterSummary` with `is_forecast` flag
  - Full CRUD API endpoints for irrigation entries (GET, POST, PUT, DELETE)
  - Weekly water summary calculations based on weather data and irrigation entries
  - Background tasks for automatic water summary calculations and updates
  - Data health checks and backfill options for water management in admin panel
  - Automatic water summary initialization for new lawns at existing locations
  - Water management page with weekly history, irrigation entry management, and status indicators
  - Dashboard integration with condensed water management cards for all lawns at a location
  - Modular frontend components for water management (WaterStatusBadge, WaterStatusCard, WaterBalanceProgress, etc.)
  - URL parameter support for pre-selecting lawns in water management page
  - Visual distinction between historical and forecast data in weekly water history
  - "Connected Devices" section marked as "Coming Soon" for future IoT integration

### Fixed

- **Water Management Data Consistency**:

  - Fixed `is_forecast` flag assignment for weekly water summaries
  - Resolved data mismatch between dashboard and water management page displays
  - Corrected weather type comparison logic in water calculations
  - Fixed task status UPSERT operations to prevent duplicate key violations
  - Resolved validation errors for irrigation entry updates (amount validation, source enum values)
  - Fixed data health checks for weekly water summaries vs daily weather data
  - Corrected admin panel display logic for water management health status

- **Frontend Build and Performance**:
  - Fixed TypeScript compilation errors in water management components
  - Resolved circular import issues in database models
  - Fixed Pydantic schema configuration for proper ORM serialization
  - Corrected API endpoint routing and parameter handling

### Changed

- **Frontend Architecture and Performance**:

  - Implemented React lazy loading and code splitting for all page components
  - Added manual chunking in Vite build configuration for vendor libraries and UI components
  - Reduced main bundle size by ~74% (from 1,268.75 kB to 331.57 kB)
  - Separated page-specific code into individual chunks for better caching
  - Added Suspense boundaries for improved loading states
  - Refactored water management page into modular, reusable components
  - Updated dashboard to display condensed water management cards for all lawns instead of single card
  - Improved bundle caching strategy with separate vendor and UI chunks

- **Backend Architecture**:

  - Enhanced Celery task orchestration for water management calculations
  - Improved database migration handling for new water management tables
  - Updated task status management with proper UPSERT operations
  - Enhanced data health monitoring to include water management metrics

- **User Experience**:
  - Improved water management page navigation with pre-selected lawn support
  - Enhanced weekly water history display with forecast indicators
  - Better visual feedback for water status (excellent, good, warning, critical)
  - Streamlined irrigation entry management with consistent UI patterns
  - Optimized mobile performance through code splitting and lazy loading

## [0.0.20] - 2025-07-21

### Added

- Water management chart with precipitation, evapotranspiration, and water balance
- Enhance the Admin Panel - add manual update weather button

### Fixed

### Changed

## [0.0.19] - 2025-07-18

### Added

- Added duplicate weather check cleanup
- Added next reset date to GDD model card on dashboard
- Added bespoke weed pressure calculation and chart

### Fixed

- Fix backfill tasks
- Fix GDD calculations

### Changed

- Hard coded the log level for the production docker compose

## [0.0.18] - 2025-07-16

### Added

- Updated Growth Potential graph to be able to select the raw, 3, 5, or 7 day average values

### Fixed

### Changed

## [0.0.17] - 2025-07-15

### Added

- Added better logging because I hate looking at compose logs

### Fixed

### Changed

## [0.0.16] - 2025-07-10

### Added

### Fixed

- Fixed weather summary 'All Time' bug defaulting to only showing past 30 days and 16 day forecast
- Fixed Smith-Kerns graph showing first 4 points as null. First 4 points will always be null as the calculation uses a 5 day window
- Fixed to look for nulls in all weather data used in calculations

### Changed

## [0.0.15] - 2025-07-07

### Added

- Growth potential graph
- Update admin panel with backfill options for missing data

### Fixed

- Disease pressure calculations and frontend date picker

### Changed

## [0.0.14] - 2025-07-05

### Added

- Add smith kern model to dashboard and update tooltips

### Fixed

### Changed

## [0.0.13] - 2025-07-04

### Added

- GDD parameter update improvements: Added "Apply to all history" option for parameter updates
- Enhanced GDD parameter editing dialog with clearer options for historical data recalculation
- Improved GDD threshold reset logic to prevent infinite recursion and ensure accurate resets

### Fixed

- Fixed GDD cumulative values exceeding threshold before resetting due to stale threshold resets
- Resolved infinite recursion bug in GDD calculation when adding threshold resets
- Improved GDD parameter update logic to handle both incremental and full historical recalculation

### Changed

- Enhanced GDD parameter update workflow with better UX for choosing between incremental updates and full historical replacement
- Updated GDD calculation logic to always clear threshold resets before recalculation to prevent stale data
- Improved backend parameter update endpoint to support replacing all previous parameter sets

## [0.0.12] - 2025-06-30

### Added

- Added gdd model cards to dashboard and now one drop down to select location in dashboard

### Fixed

### Changed

## [0.0.11] - 2025-06-30

### Added

### Fixed

- Refactor UI to modular components
- Fixed backend cascade delete for applications when deleting a lawn

### Changed

## [0.0.10] - 2025-06-30

### Added

### Fixed

- Fix gdd model calculation error
- Make sure mobile can scroll on the page

### Changed

## [0.0.9] - 2025-06-29

### Added

- Added the ability to review data per location name as all weather data is tied per location.

### Fixed

### Changed

## [0.0.8] - 2025-06-29

### Added

### Fixed

- Fix json api errors - sanitize json

### Changed

## [0.0.7] - 2025-06-28

### Added

- Weather summary on dashboard page

### Fixed

- Made weather update more generic in the logic.

### Changed

## [0.0.6] - 2025-06-24

### Added

### Fixed

- Update weather.py to include latitude and longitude that was causing failed jobs.

### Changed

## [0.0.5] - 2025-06-23

### Added

- Major mobile experience improvements across all frontend pages.
- Responsive sidebar: hamburger menu on mobile, auto-closes after navigation.
- Custom, horizontally scrollable chart legend for mobile.
- Dynamic chart axis/legend sizing and layout for mobile and desktop.
- Improved dark/light mode support for chart legends and UI elements.

### Fixed

- Sidebar now closes automatically after navigation on mobile.
- Chart legends no longer overlap or get cut off on mobile/desktop.
- X-axis date labels no longer overlap with legends or axis titles.
- Product search and add button layout fixed for mobile.
- Reports and GDD pages now fully scrollable and usable on mobile.

### Changed

- All tables, forms, and charts are now responsive and touch-friendly.
- Chart legends use user-friendly nutrient names.
- Improved overall layout and spacing for mobile and desktop.
- Updated frontend dependencies for better compatibility.

## [0.0.4] - 2025-06-23

### Added

- Nivo charting libraries (@nivo/line, @nivo/core) for modern, reliable analytics visualization.
- CSS variables for Nivo axis text color to support seamless dark/light mode switching.

### Fixed

- Chart axis, grid, and tooltip colors now correctly adapt to dark and light mode.
- Tooltip formatting for all charts: values now consistently show two decimal places.
- Table and form styling improvements for GDD and Reports pages.
- Axis label visibility and chart rendering issues in both themes.
- Removed unused custom tooltips and fixed TypeScript linter errors in frontend build.

### Changed

- Migrated all GDD and Reports charts from Recharts to Nivo for improved reliability, appearance, and theme support.
- Updated sidebar navigation (AppSidebar.tsx) for improved accessibility and theme consistency.
- Enhanced dark/light mode toggle and ensured consistent appearance across all pages.
- Updated frontend dependencies and lockfile for new charting libraries and improved compatibility.
- Improved Dockerfile for Celery worker/beat containers: better dependency installation, non-root user setup, and directory permissions.

## [0.0.3] - 2025-06-22

### Added

### Fixed

- Corrected release workflow to prevent image name interpolation errors in `test-containers` job.

### Changed

## [0.0.2] - 2025-06-22

### Added

- Container health checks in CI/CD pipeline
- Security vulnerability scanning with Trivy
- Frontend testing (linting, unit tests, build verification)
- Enhanced Docker build context for VERSION file access

### Fixed

- Docker build failures due to missing VERSION file
- Multi-platform Docker image builds

### Changed

- Split CI and Release workflows for better efficiency
- Updated build context from ./backend to . (project root)

## [0.0.1] - 2025-06-22

### Added

- Initial release

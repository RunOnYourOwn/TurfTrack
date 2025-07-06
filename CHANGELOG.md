# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

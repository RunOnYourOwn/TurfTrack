# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Fixed

### Changed

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

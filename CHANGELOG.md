# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Fixed

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

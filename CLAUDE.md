# TurfTrack - Claude Code Instructions

Full-stack turfgrass management application for tracking lawns, weather data, growing degree days (GDD), product applications, water management, and disease/weed pressure.

## Purpose (WHY)

Lawn care decisions are best driven by data, not calendar dates. TurfTrack aggregates weather data, computes growing degree days, disease pressure (Smith-Kerns model), weed pressure, and growth potential so users can make science-based turf management decisions. It replaces spreadsheets and guesswork with automated calculations and historical tracking.

## Working Environment

**Local Paths:**
- **This repo**: `/home/aaron/code_repos/TurfTrack`
- **Go application**: `go-app/`

**Services (Docker):**
- **Application**: http://localhost:8080
- **Health check**: http://localhost:8080/health
- **Version API**: http://localhost:8080/api/v1/version
- **PostgreSQL**: localhost:5432

## Quick Start

```bash
cd go-app
cp .env.example .env
docker compose up --build -d
```

## Critical Rules

### Go Patterns
- **net/http stdlib** - Standard library HTTP server with `html/template`
- **Server struct** - All handlers are methods on `*Server` (holds DB, templates, version)
- **Parameterized SQL** - Use `database/sql` with `$1, $2` placeholders, never string interpolation
- **HTMX form handling** - POST handlers parse forms, validate, persist, redirect
- **JSON API handlers** - Chart data endpoints return `application/json`

### UI Patterns
- **Server-rendered HTML** - Go `html/template` with layouts and partials
- **HTMX** - Form submissions, partial page updates, no client-side framework
- **DaisyUI v5** - Component classes on Tailwind CSS 4
- **ApexCharts** - Interactive charts loaded via JSON API endpoints

### Testing
- All new features **must have tests** (see `go-app/internal/`)
- Run unit tests: `cd go-app && go test ./... -race -count=1 -v`
- Run integration tests: `cd go-app && go test ./... -tags integration -race -count=1 -v`
- Integration tests require PostgreSQL (`TEST_DATABASE_URL` env var)
- Test coverage target: 80% minimum per package

### Database
- **SQL migrations** - Applied on startup from `go-app/migrations/`
- **Parameterized queries** - Always use `$1, $2` bind parameters
- **No ORM** - Raw SQL via `database/sql` in `internal/db/queries.go`
- **UPSERT patterns** - Idempotent storage for weather and calculation data

## Test-Driven Development

**MANDATORY**: Follow TDD workflow for all new features.

See `@.claude/rules/tdd.md` for complete workflow: Write tests first -> Confirm failure -> Commit separately -> Implement -> Confirm passing

Quick reference:
```bash
# Go
# 1. Write test in internal/<package>/<file>_test.go
# 2. Confirm test fails: cd go-app && go test ./internal/<package>/... -run TestName -v
# 3. Commit test: git commit -m "test: add tests for [feature]"
# 4. Implement feature
# 5. Verify: cd go-app && go test ./... -race -count=1 -v

# Integration tests (require PostgreSQL)
# Use //go:build integration tag
# Run: cd go-app && go test ./... -tags integration -race -count=1 -v
```

## Code Review Workflow

**Before pushing ANY branch, run**: `/code-review`

This will:
1. Analyze all changes in your branch
2. Identify performance, security, and quality issues
3. Post findings as PR comments (when PR exists)
4. Review results with you interactively

After review:
- Discuss findings and prioritize fixes
- Complete pre-PR checklist

**Pre-PR checklist**: `@.claude/rules/pre-pr-checklist.md`

**Quick pre-PR commands**:
```bash
cd go-app && go test ./... -race -count=1 -v                    # Unit tests
cd go-app && go test ./... -tags integration -race -count=1 -v   # Integration tests
cd go-app && go vet ./...                                        # Static analysis
```

## Project Structure

```
go-app/
├── cmd/server/          # Application entry point (main.go)
├── internal/
│   ├── handler/         # HTTP handlers (pages, CRUD, JSON APIs)
│   ├── calc/            # Calculation engines (GDD, disease, growth, water, weed)
│   ├── db/              # Database queries and migrations
│   ├── model/           # Data models (Go structs)
│   ├── scheduler/       # Background job scheduler (goroutine)
│   └── weather/         # OpenMeteo API client
├── migrations/          # SQL migration files (applied on startup)
├── templates/           # Go HTML templates (layouts, pages, partials)
├── static/              # Static assets (CSS, JS, images)
├── Dockerfile           # Multi-stage Docker build
└── docker-compose.yml   # Development stack (app + postgres)
```

## Documentation

For detailed information, reference using `@` syntax:

### Core Documentation
- `@README.md` - Getting started, architecture, quickstart
- `@docs/technical.md` - Database schema, calculation methodologies, API specs
- `@docs/architecture.md` - System architecture diagram and component descriptions
- `@docs/status.md` - Project status and completed features

### Code Review
- `@.claude/rules/tdd.md` - Test-driven development workflow
- `@.claude/rules/pre-pr-checklist.md` - Complete pre-PR checklist
- `@.claude/rules/code-review.md` - Code review criteria and anti-patterns
- `@.claude/rules/security.md` - Security rules, OWASP considerations

### Infrastructure
- `@CHANGELOG.md` - Version history

## Release Workflow

Follows [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

### Version Management
```bash
./scripts/version.sh current          # Show current version
./scripts/version.sh bump patch       # 1.0.0 -> 1.0.1
./scripts/version.sh bump minor       # 1.0.1 -> 1.1.0
./scripts/version.sh bump major       # 1.1.0 -> 2.0.0
./scripts/version.sh release          # Create changelog entry, commit, tag
```

### Release Process
1. Work in a feature branch, open PR to `main`
2. CI runs: Go tests (unit + integration)
3. Merge PR after checks pass
4. Create release branch: `git checkout -b release/vX.Y.Z`
5. Run: `./scripts/version.sh release patch` (or minor/major)
6. Merge release PR, then tag and push:
   ```bash
   git tag vX.Y.Z && git push github vX.Y.Z && git push origin vX.Y.Z
   ```
7. Tag triggers: tests, Docker image builds (multi-arch), Trivy scan, draft GitHub Release with CHANGELOG notes

### Conventional Commits
- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation
- `refactor:` code refactoring
- `test:` test changes
- `chore:` maintenance tasks

### Version API
Application exposes version info at `GET /api/v1/version` (version from VERSION file, environment, Go version).

## Development Commands

### Testing
```bash
cd go-app

# Unit tests
go test ./... -race -count=1 -v

# Integration tests (requires PostgreSQL)
go test ./... -tags integration -race -count=1 -v

# Single package
go test ./internal/calc/... -v

# Single test
go test ./internal/calc/... -run TestGDDCalculation -v

# Coverage
go test ./... -coverprofile=coverage.out
go tool cover -func=coverage.out
```

### Docker
```bash
cd go-app
docker compose up --build -d          # Start app + postgres
docker compose logs -f go-app         # View logs
docker compose down                   # Stop
```

### Database
```bash
# Migrations are applied automatically on startup
# Migration files: go-app/migrations/*.sql
# To add a new migration, create a new numbered SQL file
```

## Key Data Flow

Weather data is fetched from the OpenMeteo API by the in-process goroutine scheduler, stored in PostgreSQL, and used to compute derived metrics (GDD, disease pressure, weed pressure, growth potential, water balance). The browser loads server-rendered HTML pages with HTMX for interactivity and ApexCharts for chart visualization via JSON API endpoints.

## Component Status

- **HTTP Server** - Complete (all pages, CRUD handlers, JSON APIs)
- **Calculation Engines** - Complete (GDD, disease, growth potential, weed pressure, water balance)
- **Background Scheduler** - Complete (weather fetching, all calculations, startup + daily runs)
- **Database** - Complete (PostgreSQL with SQL migrations on startup)
- **CI/CD** - Complete (GitHub Actions, Docker builds to GHCR, Trivy scans, CHANGELOG-based releases)
- **UI** - Complete (responsive, dark/light theme, collapsible sidebar, mobile dock)

## Technology Stack

- **Language:** Go 1.24
- **HTTP:** net/http (stdlib), html/template, HTMX
- **UI:** DaisyUI v5, Tailwind CSS 4, ApexCharts
- **Database:** PostgreSQL 16, database/sql with raw queries
- **Weather API:** OpenMeteo (free, no API key)
- **CI/CD:** GitHub Actions, GHCR, Trivy security scanning
- **Testing:** Go testing package, integration tests with real PostgreSQL

## Related Repositories

- **GitHub**: https://github.com/RunOnYourOwn/TurfTrack

---

**Last Updated**: February 2026 | **Version**: 0.0.23 | **License**: MIT

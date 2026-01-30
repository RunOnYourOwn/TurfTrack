# TurfTrack - Claude Code Instructions

Full-stack turfgrass management application for tracking lawns, weather data, growing degree days (GDD), product applications, water management, and disease/weed pressure.

## Purpose (WHY)

Lawn care decisions are best driven by data, not calendar dates. TurfTrack aggregates weather data, computes growing degree days, disease pressure (Smith-Kerns model), weed pressure, and growth potential so users can make science-based turf management decisions. It replaces spreadsheets and guesswork with automated calculations and historical tracking.

## Working Environment

**Local Paths:**
- **This repo**: `/home/aaron/code_repos/TurfTrack`

**Services (Docker):**
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000/api/v1/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Quick Start

```bash
# Start all services
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d

# Run backend tests
cd backend && ./run_tests.sh

# Run frontend checks
cd frontend && npm run lint && npm run build
```

## Critical Rules

### Backend Patterns
- **Async everywhere** - All endpoints, database sessions, and utilities use async/await
- **Pydantic schemas** - Follow Create/Read/Update pattern per domain
- **SQLAlchemy models** - All models have `created_at`/`updated_at` timestamps
- **Domain-driven structure** - Endpoints, models, schemas, utils, and tasks organized by domain

### Frontend Patterns
- **Lazy-loaded pages** - All pages use React.lazy + Suspense for code splitting
- **TanStack Query** - All API calls go through TanStack Query with Axios clients
- **shadcn/ui components** - Use existing components in `components/ui/` before creating new ones
- **TypeScript strict** - No `any` types, proper type definitions in `types/`

### Testing
- All new endpoints **must have tests** (see `backend/tests/`)
- Run full test suite before committing: `cd backend && ./run_tests.sh`
- Test coverage: 80% minimum (enforced in CI)
- Pytest uses `asyncio_mode = auto` - async tests work without explicit decorators
- Test markers: `unit`, `integration`, `e2e`, `slow`, `api`, `models`, `utils`, `celery`, `weather`, `gdd`

### Database
- **Alembic migrations** - Never modify database schema without a migration
- **Async sessions** - Always use `async_session` from `core/database.py`
- **No raw SQL** - Use SQLAlchemy 2.0 query API

## Test-Driven Development

**MANDATORY**: Follow TDD workflow for all new features.

See `@.claude/rules/tdd.md` for complete workflow: Write tests first -> Confirm failure -> Commit separately -> Implement -> Confirm passing

Quick reference:
```bash
# Backend
# 1. Write test in tests/unit/ or tests/integration/
# 2. Confirm test fails: cd backend && python -m pytest tests/unit/test_new.py -v
# 3. Commit test: git commit -m "Add tests for [feature]"
# 4. Implement feature
# 5. Verify: cd backend && ./run_tests.sh

# Frontend
# 1. Write test alongside component
# 2. Implement feature
# 3. Verify: cd frontend && npm run lint && npm run build
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
cd backend && ./run_tests.sh              # All tests pass
cd backend && ./run_tests.sh lint          # flake8, black, isort
cd frontend && npm run lint && npm run build  # Frontend checks
```

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/     # FastAPI route handlers
│   │   ├── models/               # SQLAlchemy models
│   │   ├── schemas/              # Pydantic schemas (Create/Read/Update)
│   │   ├── utils/                # Domain logic (GDD, weather, disease, water)
│   │   ├── tasks/                # Celery task definitions
│   │   ├── core/                 # Config, database, redis
│   │   ├── middleware/           # Request logging, security headers
│   │   └── celery_app/           # Celery + RedBeat config
│   ├── alembic/                  # Database migrations
│   ├── tests/                    # Unit, integration, e2e tests
│   └── run_tests.sh              # Test runner
├── frontend/
│   └── src/
│       ├── api/                  # Axios API clients
│       ├── components/           # UI (shadcn) and domain components
│       ├── pages/                # Lazy-loaded page components
│       ├── hooks/                # Custom React hooks
│       ├── lib/                  # Utilities and helpers
│       └── types/                # TypeScript type definitions
├── docs/                         # VitePress documentation site
├── logging/                      # Loki, Promtail, Grafana stack
├── .claude/rules/                # Claude Code rules
└── docker-compose*.yml           # Docker configurations
```

## Documentation

For detailed information, reference using `@` syntax:

### Core Documentation
- `@README.md` - Getting started, installation, screenshots
- `@docs/technical.md` - Database schema, calculation methodologies, API specs
- `@docs/architecture.md` - System architecture diagram and component descriptions

### Code Review
- `@.claude/rules/tdd.md` - Test-driven development workflow
- `@.claude/rules/pre-pr-checklist.md` - Complete pre-PR checklist
- `@.claude/rules/code-review.md` - Code review criteria and anti-patterns
- `@.claude/rules/security.md` - Security rules, OWASP considerations
- `@.claude/rules/fullstack.md` - FastAPI + React patterns and best practices

### Infrastructure
- `@logging/README.md` - Logging stack (Loki, Promtail, Grafana)
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
2. CI runs: backend tests + coverage, frontend lint + build
3. Merge PR after checks pass
4. Create release branch: `git checkout -b release/vX.Y.Z`
5. Run: `./scripts/version.sh release patch` (or minor/major)
6. Merge release PR, then tag and push:
   ```bash
   git tag vX.Y.Z && git push github vX.Y.Z && git push origin vX.Y.Z
   ```
7. Tag triggers: tests, Docker image builds (multi-arch), Trivy scan, draft GitHub Release

### Conventional Commits
- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation
- `refactor:` code refactoring
- `test:` test changes
- `chore:` maintenance tasks

### Version API
Backend exposes version info at `GET /api/v1/version` (commit hash, branch, tag, environment).

## Development Commands

### Backend Testing
```bash
cd backend
./run_tests.sh              # All tests
./run_tests.sh unit         # Unit tests only
./run_tests.sh integration  # Integration tests only
./run_tests.sh coverage     # With coverage (80% minimum)
./run_tests.sh fast         # Without coverage
./run_tests.sh lint         # flake8, black, isort checks
```

Single test file: `cd backend && python -m pytest tests/unit/test_foo.py -v`
Single test: `cd backend && python -m pytest tests/unit/test_foo.py::test_bar -v`

### Frontend
```bash
cd frontend
npm ci          # Install dependencies
npm run dev     # Dev server
npm run build   # Production build (runs tsc then vite build)
npm run lint    # ESLint
```

### Database Migrations
```bash
cd backend
alembic upgrade head           # Apply migrations
alembic revision --autogenerate -m "description"  # Create migration
```

### Backend Dependencies
Uses `uv` package manager. Dependencies defined in `backend/pyproject.toml`.
```bash
cd backend && uv pip install -e .
```

## Key Data Flow

Weather data is fetched from the OpenMeteo API via Celery tasks, stored in PostgreSQL, and used to compute derived metrics (GDD, disease pressure, weed pressure, growth potential). The frontend consumes all data through the REST API with TanStack Query for caching.

## Component Status

- **Backend API** - Complete (lawns, weather, GDD, products, applications, water, reports)
- **Frontend UI** - Complete (all pages, dark/light mode, responsive)
- **Celery Tasks** - Complete (weather fetching, GDD calculations, RedBeat scheduling)
- **Database** - Complete (PostgreSQL with Alembic migrations)
- **CI/CD** - Complete (GitHub Actions, Docker builds to GHCR, Trivy scans)
- **Documentation Site** - Partial (VitePress site, user guides are stubs)
- **Logging Stack** - Complete (Loki, Promtail, Grafana)

## Technology Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0, Celery, Redis, PostgreSQL
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, TanStack Query
- **Infrastructure:** Docker Compose, GitHub Actions, GHCR
- **Observability:** Loki, Promtail, Grafana
- **Testing:** Pytest (async), ESLint, TypeScript compiler

## Related Repositories

- **GitHub**: https://github.com/RunOnYourOwn/TurfTrack

---

**Last Updated**: January 2026 | **Version**: 0.0.22 | **License**: MIT

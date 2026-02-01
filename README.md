<p align="center">
  <img src="assets/logo.png" alt="TurfTrack Logo" width="200"/>
</p>

# TurfTrack

[![CI](https://github.com/RunOnYourOwn/TurfTrack/actions/workflows/ci.yml/badge.svg)](https://github.com/RunOnYourOwn/TurfTrack/actions/workflows/ci.yml)
[![Release](https://github.com/RunOnYourOwn/TurfTrack/actions/workflows/release.yml/badge.svg)](https://github.com/RunOnYourOwn/TurfTrack/actions/workflows/release.yml)

TurfTrack is a data-driven turfgrass management application for tracking lawns, weather data, growing degree days (GDD), product applications, water management, and disease/weed pressure.

---

## Project Overview

- **Backend:** Go (net/http, html/template, HTMX)
- **Database:** PostgreSQL with SQL migrations
- **UI:** Server-rendered HTML with DaisyUI + Tailwind CSS + HTMX + ApexCharts
- **Scheduling:** In-process goroutine scheduler (no external queue)
- **Containerization:** Docker, Docker Compose

TurfTrack provides:

- Weather data ingestion from OpenMeteo (historical + forecast)
- Growing degree day model management and analytics
- Disease pressure (Smith-Kerns model) and weed pressure calculations
- Growth potential tracking for cool/warm season grasses
- Product and application tracking with nutrient calculations
- Water management with ET0-based deficit tracking
- Admin settings UI for scheduler configuration

---

## Architecture

```
┌──────────────────────────────────────────────┐
│             Go Binary (single process)       │
│                                              │
│  ┌─────────────┐  ┌──────────────────────┐   │
│  │ HTTP Server  │  │ Background Scheduler │   │
│  │ (net/http)   │  │ (goroutine)          │   │
│  │              │  │                      │   │
│  │ HTML pages   │  │ Weather fetch        │   │
│  │ HTMX actions │  │ GDD calculation      │   │
│  │ JSON APIs    │  │ Disease pressure     │   │
│  │ Static files │  │ Growth potential     │   │
│  └──────┬───────┘  │ Weed pressure        │   │
│         │          │ Water summaries      │   │
│         │          └──────────┬───────────┘   │
│         │                     │               │
│         └─────────┬───────────┘               │
│                   │                           │
│              ┌────▼────┐   ┌──────────────┐   │
│              │PostgreSQL│   │ OpenMeteo API│   │
│              └─────────┘   └──────────────┘   │
└──────────────────────────────────────────────┘
```

- Single binary deployment (no Redis, Celery, or separate workers)
- Server-rendered HTML with HTMX for interactivity
- JSON API endpoints for chart data (ApexCharts)
- In-process scheduler replaces Celery Beat + Worker

---

## Quickstart

### Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose

### 1. Clone the Repository

```bash
git clone https://github.com/RunOnYourOwn/TurfTrack.git
cd TurfTrack/go-app
```

### 2. Run the Application

```bash
cp .env.example .env
docker compose up -d
```

The application will be available at [http://localhost:8080](http://localhost:8080).

---

## For Developers

### Local Development

```bash
cd go-app
cp .env.example .env
docker compose up --build -d
```

- Application: [http://localhost:8080](http://localhost:8080)
- Health check: [http://localhost:8080/health](http://localhost:8080/health)
- Version: [http://localhost:8080/api/v1/version](http://localhost:8080/api/v1/version)

### Running Tests

```bash
cd go-app

# Unit tests
go test ./... -race -count=1 -v

# Integration tests (requires PostgreSQL)
go test ./... -tags integration -race -count=1 -v
```

### Project Structure

```
go-app/
├── cmd/server/          # Application entry point
├── internal/
│   ├── handler/         # HTTP handlers (pages, CRUD, JSON APIs)
│   ├── calc/            # Calculation engines (GDD, disease, growth, water, weed)
│   ├── db/              # Database queries and migrations
│   ├── model/           # Data models
│   ├── scheduler/       # Background job scheduler
│   └── weather/         # OpenMeteo API client
├── migrations/          # SQL migration files
├── templates/           # Go HTML templates (layouts, pages, partials)
├── static/              # Static assets
├── Dockerfile           # Multi-stage Docker build
└── docker-compose.yml   # Development stack (app + postgres)
```

---

## Technology Stack

- **Language:** Go 1.24
- **HTTP:** net/http (stdlib), html/template, HTMX
- **UI:** DaisyUI v5, Tailwind CSS 4, ApexCharts
- **Database:** PostgreSQL 16
- **Weather API:** OpenMeteo (free, no API key)
- **CI/CD:** GitHub Actions, GHCR, Trivy security scanning
- **Testing:** Go testing package, integration tests with real PostgreSQL

---

## Contributing

- Use feature branches and pull requests
- Write tests for new functionality (80% coverage target)
- Follow TDD workflow (tests first, commit separately)
- Run `go test ./... -race` before pushing

---

## Documentation

- [Architecture](docs/architecture.md)
- [Technical Specs](docs/technical.md)
- [Project Status](docs/status.md)
- [Version History](CHANGELOG.md)

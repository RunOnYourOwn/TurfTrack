# TurfTrack

[![CI](https://github.com/RunOnYourOwn/TurfTrack/actions/workflows/ci.yml/badge.svg)](https://github.com/RunOnYourOwn/TurfTrack/actions/workflows/ci.yml)
![Code Coverage](./coverage-badge.svg)

TurfTrack is a modern, full-stack application for managing turfgrass maintenance, weather data, growing degree day (GDD) models, and product applications.

---

## 🚀 Project Overview

- **Backend:** FastAPI (Python), SQLAlchemy, Celery, Redis, PostgreSQL
- **Frontend:** React (Vite, TypeScript), shadcn/ui, TanStack Query
- **Containerization:** Docker, Docker Compose
- **Testing:** Pytest, pytest-cov, factory-boy, httpx

TurfTrack provides:

- Weather data ingestion and deduplication
- GDD model management and analytics
- Product and application tracking
- Task monitoring and scheduling
- Modern, responsive UI

---

## 🏗️ Architecture Summary

- **Backend:** FastAPI REST API, async SQLAlchemy, Celery for background jobs, Redis for caching and task queue, PostgreSQL for persistent storage
- **Frontend:** Vite + React + TypeScript, shadcn/ui for UI components, TanStack Query for data fetching/caching
- **Deployment:** All services run in Docker containers as non-root users for security

---

## ⚡ Quickstart & Setup

### Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose
- [Node.js](https://nodejs.org/) (for frontend development)
- [Python 3.11+](https://www.python.org/) (for backend development)

### 1. Clone the Repository

```bash
git clone https://github.com/RunOnYourOwn/TurfTrack.git
cd TurfTrack
```

### 2. Environment Variables

- Copy `.env.example` to `.env` in the project root:
  ```bash
  cp .env.example .env
  ```
- Fill in any required values in `.env` (see comments in `.env.example` for details)

### 3. Start with Docker Compose

This project provides multiple ways to run the application depending on your needs.

#### Production (Recommended for Users)

This is the simplest way to run the application. It uses pre-built images from the GitHub Container Registry.

```bash
docker-compose -f docker-compose.standalone.yml up -d
```

- The application will be available at [http://localhost:3000](http://localhost:3000).
- To update the application to a newer version, open `docker-compose.standalone.yml` and change the version tag on the `api`, `frontend`, and `celery` images.

#### Development

This method is for developers who want to work on the code. It mounts the local source code into the containers and enables hot-reloading.

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
```

- The frontend will be available at [http://localhost:5173](http://localhost:5173).
- The backend API will be available at [http://localhost:8000/api/v1].

---

## 🧪 Testing & Coverage

- Run all backend tests:
  ```bash
  cd backend
  ./run_tests.sh
  ```
- Coverage reports will be shown in the terminal.
- All core modules, schemas, and utilities are covered (see `docs/before_production.md` for details).

To run the full test suite, use the test runner script in the backend:

```bash
cd backend
./run_tests.sh coverage
```

## Container Images & Deployment

This project uses GitHub Actions to automatically build and publish versioned Docker images to the GitHub Container Registry (GHCR). See `docker-compose.standalone.yml` for an example of how to use them.

### Image Versioning

Three separate images are published: `turftrack-backend`, `turftrack-celery`, and `turftrack-frontend`. The following tagging strategy is used:

- `:latest`: For every push to the `main` branch, images are tagged with `:latest`. This tag represents the most recent development build.
- `:sha-xxxxxxx`: Every commit-specific image is tagged with its short git SHA (e.g., `:cb758e7`).
- `:<version>`: When a formal release is created, images are tagged with the corresponding semantic version number (e.g., `v1.2.3`).

### Creating a Release

To create a new, versioned release (for maintainers):

1.  Ensure all your changes are on the `main` branch.
2.  Use the `version.sh` script to bump the version number. For example, to create a patch release:
    ```bash
    ./scripts/version.sh release patch
    ```
3.  This will push a new version tag to GitHub, which triggers the `Release` workflow.
4.  The workflow will test, build, and publish the images, and create a draft release on GitHub.
5.  Go to the GitHub Releases page to review and publish the draft.

---

## 🛠️ Development Workflow

- Use feature branches and pull requests for changes
- Write unit tests for all new backend logic
- Use the `.env.example` file to keep environment variables up to date
- Linting/formatting: (add details if you use black, flake8, eslint, prettier, etc.)

---

## 🚢 Production & Deployment

- All containers run as non-root users for security
- Use Docker Compose for deployment
- Ensure `.env` is set with production values and not committed to version control
- See `docs/before_production.md` for a full checklist before going live

---

## 🤝 Contributing & Support

- See `docs/` for architecture, technical details, and tasks
- Open issues or pull requests for bugs, features, or questions
- Contact the maintainers via GitHub or your organization's preferred channel

---

## 📄 Documentation

- [Architecture Diagram](docs/architecture.mermaid)
- [Technical Specs](docs/technical.md)
- [Production Checklist](docs/before_production.md)
- [Task List](docs/tasks.md)
- [Status & Progress](docs/status.md)

# Pre-Production Checklist & Best Practices Review

This document tracks the necessary improvements and best practices to implement before the project is considered fully production-ready.

---

## 1. Backend (FastAPI)

The backend is well-structured, following many of FastAPI's conventions. The use of Pydantic, SQLAlchemy, and APIRouters is solid.

### ✅ What's Done Well

- **Async Support:** All endpoint and database operations are `async`, which is excellent for performance.
- **Dependency Injection:** Using `Depends(get_db)` for database sessions is the correct pattern for managing resources.
- **Configuration Management:** `pydantic-settings` is used to manage settings from environment variables and `.env` files.
- **Code Organization:** The project is logically structured into `api`, `core`, `models`, `schemas`, and `tasks`.

### 💡 Areas for Improvement

- [x] **Refactor DTO Mapping:** In endpoints (`lawn.py`, etc.), you manually map SQLAlchemy models to Pydantic schemas.

  - **Recommendation:** Add `from_attributes = True` to Pydantic schemas and return the SQLAlchemy objects directly from endpoints to reduce boilerplate and prevent errors.

- [x] **Abstract Duplicated Logic:** The logic to trigger the weather fetch task is duplicated in both the `create_lawn` and `update_lawn` endpoints.

  - **Recommendation:** Refactor this into a single utility function (e.g., in `app/utils/weather.py`) to keep endpoint logic clean and DRY.

- [x] **Use Database-Level Cascading Deletes:** The `delete_lawn` endpoint manually cleans up related data (location, weather).

  - **Recommendation:** Configure `ondelete="CASCADE"` in the SQLAlchemy models for foreign key relationships. This is more efficient and reliable. _Note: This will require a new Alembic migration._

- [x] **Improve Error Handling:** Several endpoints use bare `except Exception:` blocks which can mask important errors.

  - **Recommendation:** Replace generic exception handling with specific exception types and proper error logging. For example, in `gdd.py` line 245, the date parsing should catch `ValueError` specifically, not all exceptions.

- [x] **Implement Request Validation:** Some endpoints lack proper input validation beyond Pydantic schemas.

  - **Recommendation:** Add custom validators for business logic (e.g., date ranges, coordinate validation) and implement proper error responses for invalid inputs.

- [ ] **Add API Rate Limiting:** The API currently has no rate limiting, which could lead to abuse in production.

  - **Recommendation:** Implement rate limiting middleware using libraries like `slowapi` or custom middleware to protect against abuse.

- [x] **Improve Logging Configuration:** Current logging is basic and doesn't follow production best practices.

  - **Recommendation:** Implement structured logging with proper log levels, add request/response logging middleware, and configure log rotation for production.

- [x] **Add Health Check Endpoints:** No health check endpoints for monitoring and load balancers.

  - **Recommendation:** Add `/health` and `/ready` endpoints that check database connectivity, Redis connectivity, and other critical dependencies.

- [ ] **Implement API Versioning Strategy:** The API uses `/api/v1/` but has no clear versioning strategy for future changes.

  - **Recommendation:** Document API versioning strategy and implement proper deprecation warnings for future breaking changes.

- [ ] **Add Request/Response Middleware:** No middleware for request tracking, performance monitoring, or security headers.

  - **Recommendation:** Add middleware for request ID tracking, CORS headers, security headers (HSTS, CSP), and performance monitoring.

- [ ] **Optimize Database Queries:** Some endpoints may have N+1 query problems or inefficient queries.

  - **Recommendation:** Review all database queries, add proper eager loading where needed, and consider adding database query monitoring in development.

- [ ] **Add Database Indexes:** Some queries may be slow because they filter on un-indexed columns.

  - **Recommendation:** Add `index=True` to columns that are frequently used in `WHERE` clauses, such as dates or foreign keys if they are not already indexed. For example, `application_date` in the `applications` table.
    ```python
    # In models/application.py
    application_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    ```
    _Note: This will require a new Alembic migration._

- [ ] **Add Comprehensive Testing:** The project has a test directory structure but no actual tests.

  - **Recommendation:** Add unit tests for all endpoints, models, and utility functions. Include integration tests for database operations and API workflows. Use pytest fixtures for database setup/teardown.

---

## 2. Frontend (React)

The frontend uses modern tools like Vite, TypeScript, and TanStack Query, which is a great foundation.

### ✅ What's Done Well

- **Data Fetching:** Using `@tanstack/react-query` (`useQuery`) simplifies server state management, caching, and re-fetching.
- **Component Library:** `shadcn/ui` provides beautiful, accessible, and consistent UI components.
- **TypeScript:** The use of TypeScript is essential for building a scalable and maintainable frontend.
- **Structure:** Standard directory structure (`pages`, `components`, `layouts`) is easy to follow.

### 💡 Areas for Improvement

- [ ] **Break Down Large Components:** Pages like `Lawns.tsx` manage too much state, making them large and hard to maintain.

  - **Recommendation:** Decompose pages into smaller, focused components (`AddLawnForm.tsx`, `EditLawnDialog.tsx`, etc.) that manage their own state.

- [ ] **Use `useMutation` for API Calls:** API mutations (POST, PUT, DELETE) are currently handled with `fetcher` inside event handlers.

  - **Recommendation:** Use the `useMutation` hook from `@tanstack/react-query` to handle mutations. This simplifies loading/error states and provides cleaner side-effect management (like query invalidation).

- [ ] **Adopt a Form Management Library:** Form state is managed manually with `useState`.

  - **Recommendation:** For complex forms, use a library like `react-hook-form` with `zod` for validation to reduce boilerplate and improve robustness.

- [ ] **Implement Frontend Code Splitting:** The frontend Javascript bundle could become large as the application grows, slowing down initial page loads.

  - **Recommendation:** Use route-based code splitting. Vite makes this easy with `React.lazy` and dynamic `import()` statements. This loads the code for each page only when the user navigates to it.

    ```tsx
    // In App.tsx
    import { lazy, Suspense } from "react";

    const Dashboard = lazy(() => import("./pages/Dashboard"));
    const Lawns = lazy(() => import("./pages/Lawns"));
    // ... import other pages lazily

    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/lawns" element={<Lawns />} />
        {/* ... other routes */}
      </Routes>
    </Suspense>;
    ```

---

## 3. Docker & Deployment

The Docker setup provides a good separation between development and production environments.

### ✅ What's Done Well

- **Multi-stage Builds:** Production Dockerfiles use multi-stage builds to create small, secure images.
- **Separate Environments:** Distinct `dev` and `prod` compose files allow for environment-specific configurations.
- **Healthchecks:** The `db` service healthcheck ensures a proper startup order.

### 💡 Areas for Improvement

- [ ] **Run as Non-Root User:** Containers are currently running as the `root` user, which is a security risk.

  - **Recommendation:** In production Dockerfiles, create and switch to a non-root user before running the application.

- [ ] **Add `.dockerignore` Files:** The project is missing `.dockerignore` files.

  - **Recommendation:** Add `.dockerignore` files to the `frontend` and `backend` directories to prevent secrets, local dependencies, and git history from being included in the build context.

- [ ] **Keep Compose Files DRY:** The `docker-compose.prod.yml` repeats many environment variables across services.

  - **Recommendation:** Use YAML anchors or `x-` extension fields to define common environment blocks once and reuse them.

---

## 4. General Project

- [ ] **Create a `.env.example` File:** This is crucial for onboarding new developers.

  - **Recommendation:** Add a `.env.example` file to the project root that documents all required environment variables without committing any secrets.

- [ ] **Improve Root `README.md`:** The project needs a central `README.md` that explains the architecture, setup, and how to run the application.

  - **Recommendation:** Expand the `README.md` with clear instructions for both development and production environments.

---

## 5. Performance Optimizations

- [ ] **Fix N+1 Query in `list_applications`:** The endpoint currently fetches applications and then lazy-loads the related `Lawn` and `Product` for each one, causing many unnecessary database queries.

  - **Recommendation:** Use `selectinload` in `endpoints/application.py` to eager-load the relationships in a single query.
    ```python
    # In list_applications endpoint
    from sqlalchemy.orm import selectinload
    # ...
    query = select(Application).options(
        selectinload(Application.lawn),
        selectinload(Application.product)
    )
    ```

- [ ] **Add Database Indexes:** Some queries may be slow because they filter on un-indexed columns.

  - **Recommendation:** Add `index=True` to columns that are frequently used in `WHERE` clauses, such as dates or foreign keys if they are not already indexed. For example, `application_date` in the `applications` table.
    ```python
    # In models/application.py
    application_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    ```
    _Note: This will require a new Alembic migration._

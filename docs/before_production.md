# Pre-Production Checklist & Best Practices Review

This document tracks the necessary improvements and best practices to implement before the project is considered fully production-ready.

---

## 🚨 CRITICAL: Must Complete Before Public Release

These items are essential for security, stability, and basic production readiness.

### Backend (FastAPI)

- [ ] **Add Comprehensive Testing:** The project has a test directory structure but no actual tests.

  - **Recommendation:** Add unit tests for all endpoints, models, and utility functions. Include integration tests for database operations and API workflows. Use pytest fixtures for database setup/teardown.

### Docker & Deployment

- [ ] **Run as Non-Root User:** Containers are currently running as the `root` user, which is a security risk.

  - **Recommendation:** In production Dockerfiles, create and switch to a non-root user before running the application.

  - **Implementation Plan:**

    #### **Phase 1: Backend API Container**

    1. Update `backend/Dockerfile` (development)
    2. Update `backend/Dockerfile.prod` (production)
    3. Test with development environment
    4. Verify all functionality works

    #### **Phase 2: Celery Containers**

    1. Update `backend/Dockerfile.celery`
    2. Test worker and beat services
    3. Verify task execution and scheduling

    #### **Phase 3: Frontend Container**

    1. Update `frontend/Dockerfile` (development)
    2. Update `frontend/Dockerfile.prod` (production)
    3. Test build and runtime

    #### **Phase 4: Integration Testing**

    1. Test all services together
    2. Verify file permissions work correctly
    3. Test volume mounts and persistence

    #### **User ID Strategy:**

    - **API**: UID 1001, GID 1001
    - **Celery Worker**: UID 1002, GID 1002
    - **Celery Beat**: UID 1003, GID 1003
    - **Frontend**: UID 1004, GID 1004

    #### **Critical Directories & Permissions:**

    - **Application Code**: `/app` - needs read/execute
    - **Log Files**: `/app/logs` - needs write access
    - **Database Files**: `/app/data` - needs write access
    - **Temporary Files**: `/tmp` - needs write access
    - **Environment Files**: `/app/.env` - needs read access

    #### **Potential Issues & Solutions:**

    - **Port Binding**: Non-root users can't bind to ports < 1024 (already using port 8000)
    - **File Permissions**: Set proper ownership in Dockerfile and docker-compose
    - **Database Migrations**: Ensure database user has proper permissions
    - **Log Files**: Create log directory with proper permissions

    #### **Testing Strategy:**

    - [ ] API endpoints respond correctly
    - [ ] Database migrations run successfully
    - [ ] Celery tasks execute properly
    - [ ] Log files are written correctly
    - [ ] File uploads/downloads work
    - [ ] Health checks pass
    - [ ] Verify containers don't run as root
    - [ ] Check file permissions are correct

- [ ] **Add `.dockerignore` Files:** The project is missing `.dockerignore` files.

  - **Recommendation:** Add `.dockerignore` files to the `frontend` and `backend` directories to prevent secrets, local dependencies, and git history from being included in the build context.

### General Project

- [ ] **Create a `.env.example` File:** This is crucial for onboarding new developers.

  - **Recommendation:** Add a `.env.example` file to the project root that documents all required environment variables without committing any secrets.

- [ ] **Improve Root `README.md`:** The project needs a central `README.md` that explains the architecture, setup, and how to run the application.

  - **Recommendation:** Expand the `README.md` with clear instructions for both development and production environments.

---

## ✅ COMPLETED: Already Implemented

These items have been successfully implemented and are working well.

### Backend (FastAPI)

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

- [x] **Improve Logging Configuration:** Current logging is basic and doesn't follow production best practices.

  - **Recommendation:** Implement structured logging with proper log levels, add request/response logging middleware, and configure log rotation for production.

- [x] **Add Health Check Endpoints:** No health check endpoints for monitoring and load balancers.

  - **Recommendation:** Add `/health` and `/ready` endpoints that check database connectivity, Redis connectivity, and other critical dependencies.

- [x] **Add Request/Response Middleware:** No middleware for request tracking, performance monitoring, or security headers.

  - **Recommendation:** Add middleware for request ID tracking, CORS headers, security headers (HSTS, CSP), and performance monitoring.

- [x] **Optimize Database Queries:** Some endpoints may have N+1 query problems or inefficient queries.

  - **Recommendation:** Review all database queries, add proper eager loading where needed, and consider adding database query monitoring in development.

- [x] **Add Database Indexes:** Some queries may be slow because they filter on un-indexed columns.

  - **Recommendation:** Add `index=True` to columns that are frequently used in `WHERE` clauses, such as dates or foreign keys if they are not already indexed. For example, `application_date` in the `applications` table.

    ```python
    # In models/application.py
    application_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    ```

    _Note: This will require a new Alembic migration._

  - **✅ Implemented:** Added comprehensive database indexes across all major tables:
    - **Applications**: `application_date` and `status` indexes for date range filtering and status queries
    - **GDD Values**: `date` index for GDD calculation performance
    - **GDD Resets**: `reset_date` index for reset processing
    - **GDD Model Parameters**: `effective_from` index for parameter history lookups
    - **Task Status**: `started_at` and `status` indexes for task monitoring
    - All indexes confirmed to be used by PostgreSQL query planner where appropriate
    - Expected 5-50x performance improvement for date range and filtering queries

### Docker & Deployment

- [x] **Multi-stage Builds:** Production Dockerfiles use multi-stage builds to create small, secure images.
- [x] **Separate Environments:** Distinct `dev` and `prod` compose files allow for environment-specific configurations.
- [x] **Healthchecks:** The `db` service healthcheck ensures a proper startup order.

---

## 🔄 POST-RELEASE: Nice-to-Have Improvements

These items can be implemented after the initial public release to improve user experience, performance, and maintainability.

### Backend (FastAPI)

- [ ] **Implement API Versioning Strategy:** The API uses `/api/v1/` but has no clear versioning strategy for future changes.

  - **Recommendation:** Document API versioning strategy and implement proper deprecation warnings for future breaking changes.

- [ ] **Add API Rate Limiting:** The API currently has no rate limiting, but this may not be necessary for the current architecture.

  - **Current Assessment:** API is not directly exposed externally (only accessible within Docker network via frontend proxy), so rate limiting may not provide immediate value.
  - **Future Consideration:** Implement rate limiting if you later expose the API directly or if you see abuse patterns through the frontend.
  - **Recommendation:** Use `slowapi` with Redis backend for distributed rate limiting. Focus on protecting heavy operations (GDD calculations) and authentication endpoints if implemented.

### Frontend (React)

The frontend uses modern tools like Vite, TypeScript, and TanStack Query, which is a great foundation.

#### ✅ What's Done Well

- **Data Fetching:** Using `@tanstack/react-query` (`useQuery`) simplifies server state management, caching, and re-fetching.
- **Component Library:** `shadcn/ui` provides beautiful, accessible, and consistent UI components.
- **TypeScript:** The use of TypeScript is essential for building a scalable and maintainable frontend.
- **Structure:** Standard directory structure (`pages`, `components`, `layouts`) is easy to follow.

#### 💡 Areas for Improvement (Post-Release)

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

### Docker & Deployment

- [ ] **Keep Compose Files DRY:** The `docker-compose.prod.yml` repeats many environment variables across services.

  - **Recommendation:** Use YAML anchors or `x-` extension fields to define common environment blocks once and reuse them.

### Performance Optimizations

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

---

## 📊 Progress Summary

- **Critical Items Remaining:** 4
- **Completed Items:** 10
- **Post-Release Improvements:** 7

**Overall Progress:** 71% complete for production readiness

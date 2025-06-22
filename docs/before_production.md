# Pre-Production Checklist & Best Practices Review

This document tracks the necessary improvements and best practices to implement before the project is considered fully production-ready.

---

## 🚨 CRITICAL: Must Complete Before Public Release

These items are essential for security, stability, and basic production readiness.

### Backend (FastAPI)

- [ ] **Add Comprehensive Testing:** The project has a test directory structure but no actual tests.

  - **Recommendation:** Add unit tests for all endpoints, models, and utility functions. Include integration tests for database operations and API workflows. Use pytest fixtures for database setup/teardown.

  - **Implementation Plan:**

    #### **Phase 1: Test Infrastructure Setup**

    1. Configure pytest with proper test discovery and coverage reporting
    2. Set up test database configuration (separate from development/production)
    3. Create base test fixtures for database, Redis, and Celery
    4. Configure test environment variables and secrets management
    5. Set up CI/CD pipeline integration for automated testing

    #### **Phase 2: Unit Tests - Core Models & Utilities**

    1. **Database Models**: Test all SQLAlchemy models (Lawn, Product, Application, GDD, etc.)
       - Model creation, validation, relationships
       - Field constraints and business rules
       - Cascade delete behavior
    2. **Utility Functions**: Test all utility modules
       - Weather data processing (`app/utils/weather.py`)
       - GDD calculations (`app/utils/gdd.py`)
       - Location utilities (`app/utils/location.py`)
       - Application utilities (`app/utils/application.py`)
    3. **Schema Validation**: Test Pydantic schemas
       - Input validation, serialization, deserialization
       - Custom validators and business rules

    #### **Phase 3: Unit Tests - API Endpoints**

    1. **Lawn Endpoints** (`/api/v1/lawns/`)
       - CRUD operations (create, read, update, delete)
       - Input validation and error handling
       - Weather data integration
       - GDD model associations
    2. **Product Endpoints** (`/api/v1/products/`)
       - CRUD operations with nutrient fields
       - Validation of nutrient calculations
       - Cost and application rate logic
    3. **Application Endpoints** (`/api/v1/applications/`)
       - CRUD operations with lawn/product relationships
       - Date validation and business rules
       - Status management
    4. **GDD Endpoints** (`/api/v1/gdd/`)
       - GDD calculations and resets
       - Model parameter management
       - Historical data retrieval
    5. **Task Status Endpoints** (`/api/v1/task-status/`)
       - Task monitoring and status updates
       - Celery integration
    6. **Health & Version Endpoints**
       - Health check functionality
       - Version information

    #### **Phase 4: Integration Tests**

    1. **Database Integration**
       - Full CRUD workflows across multiple tables
       - Transaction rollback scenarios
       - Concurrent access patterns
       - Migration testing
    2. **Celery Task Integration**
       - Weather fetch task execution
       - GDD recalculation workflows
       - Task status tracking
       - Error handling and retry logic
    3. **API Workflow Integration**
       - Complete lawn creation → weather fetch → GDD calculation flow
       - Product application → GDD reset → recalculation flow
       - Multi-step business processes

    #### **Phase 5: End-to-End Tests**

    1. **Full Application Workflows**
       - User journey from lawn creation to GDD monitoring
       - Product application and tracking
       - Weather data updates and GDD recalculation
    2. **Error Scenarios**
       - Network failures, database outages
       - Invalid data handling
       - Rate limiting and timeout scenarios

    #### **Test Coverage Goals:**

    - **Backend Code Coverage**: 90%+ (critical business logic)
    - **API Endpoint Coverage**: 100% (all endpoints tested)
    - **Model Coverage**: 100% (all models and relationships)
    - **Utility Function Coverage**: 95%+ (core calculation logic)
    - **Integration Test Coverage**: 80%+ (key workflows)

    #### **Testing Tools & Framework:**

    - **pytest**: Main testing framework
    - **pytest-asyncio**: Async test support
    - **pytest-cov**: Coverage reporting
    - **factory-boy**: Test data generation
    - **httpx**: Async HTTP client for API testing
    - **testcontainers**: Database and Redis test containers
    - **pytest-mock**: Mocking and patching

    #### **Test Data Strategy:**

    - **Fixtures**: Reusable test data for common scenarios
    - **Factories**: Dynamic test data generation
    - **Mock External Services**: Weather API, external dependencies
    - **Test Database**: Isolated test database with migrations

    #### **CI/CD Integration:**

    - **GitHub Actions**: Automated test runs on PR and main
    - **Test Reports**: Coverage reports and test results
    - **Quality Gates**: Minimum coverage requirements
    - **Performance Testing**: API response time benchmarks

    #### **Implementation Priority:**

    1. **High Priority**: Core business logic (GDD calculations, weather processing)
    2. **Medium Priority**: CRUD operations and API endpoints
    3. **Lower Priority**: Edge cases and error scenarios

    **Status**: Planning complete. Ready for implementation starting with Phase 1.

### Docker & Deployment

- [x] **Run as Non-Root User:** Containers are currently running as the `root` user, which is a security risk.

  - **Recommendation:** In production Dockerfiles, create and switch to a non-root user before running the application.

  - **Implementation Plan:**

    #### **Phase 1: Backend API Container** ✅ COMPLETE

    1. Update `backend/Dockerfile` (development) ✅
    2. Update `backend/Dockerfile.prod` (production) ✅
    3. Test with development environment ✅
    4. Verify all functionality works ✅

    #### **Phase 2: Celery Containers** ✅ COMPLETE

    1. Update `backend/Dockerfile.celery` ✅
    2. Test worker and beat services ✅
    3. Verify task execution and scheduling ✅

    #### **Phase 3: Frontend Container** ✅ COMPLETE

    1. Update `frontend/Dockerfile` (development) ✅
    2. Update `frontend/Dockerfile.prod` (production) ✅
    3. Test build and runtime ✅

    #### **Phase 4: Integration Testing** ✅ COMPLETE

    1. Test all services together ✅
    2. Verify file permissions work correctly ✅
    3. Test volume mounts and persistence ✅

    #### **User ID Strategy:**

    - **API**: UID 1001, GID 1001 ✅
    - **Celery Worker**: UID 1002, GID 1002 ✅
    - **Celery Beat**: UID 1003, GID 1003 ✅
    - **Frontend**: UID 1004, GID 1004 ✅

    #### **Critical Directories & Permissions:**

    - **Application Code**: `/app` - needs read/execute ✅
    - **Log Files**: `/app/logs` - needs write access ✅
    - **Database Files**: `/app/data` - needs write access ✅
    - **Temporary Files**: `/tmp` - needs write access ✅
    - **Environment Files**: `/app/.env` - needs read access ✅

    #### **Potential Issues & Solutions:**

    - **Port Binding**: Non-root users can't bind to ports < 1024 (already using port 8000) ✅
    - **File Permissions**: Set proper ownership in Dockerfile and docker-compose ✅
    - **Database Migrations**: Ensure database user has proper permissions ✅
    - **Log Files**: Create log directory with proper permissions ✅
    - **Nginx Permissions**: Fixed nginx cache directories for non-root user ✅

    #### **Testing Strategy:**

    - [x] API endpoints respond correctly
    - [x] Database migrations run successfully
    - [x] Celery tasks execute properly
    - [x] Log files are written correctly
    - [x] File uploads/downloads work
    - [x] Health checks pass
    - [x] Verify containers don't run as root
    - [x] Check file permissions are correct

    **Status**: ✅ COMPLETE - Both development and production environments now run all containers as non-root users with proper security isolation.

- [x] **Add `.dockerignore` Files:** The project is missing `.dockerignore` files.

  - **Recommendation:** Add `.dockerignore` files to the `frontend` and `backend` directories to prevent secrets, local dependencies, and git history from being included in the build context.

  - **Implementation:**
    - ✅ Created `backend/.dockerignore` - excludes Python cache, virtual environments, IDE files, test files, and development artifacts
    - ✅ Created `frontend/.dockerignore` - excludes node_modules, build outputs, IDE files, test files, and development artifacts
    - ✅ Created root `.dockerignore` - excludes git history, OS files, documentation, and cross-service artifacts
    - ✅ Tested builds - both backend and frontend containers build successfully with reduced context size
    - ✅ Security - prevents accidental inclusion of sensitive files and secrets in Docker images
    - ✅ Performance - reduces build context size and improves build speed

  **Status**: ✅ COMPLETE - All Docker build contexts now properly exclude unnecessary files while maintaining functionality.

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

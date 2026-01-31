# Go + HTMX Refactor Verification Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure all functionality in the refactored Go + HTMX TurfTrack app is working and comprehensively tested, with integration tests that verify database operations, HTTP handlers, and end-to-end form workflows.

**Architecture:** The app is a single Go binary serving HTMX templates + JSON API endpoints, backed by PostgreSQL. Tests use `database/sql` with a real test database (via Docker) for integration tests, and `httptest` for handler tests. Unit tests (calc, weather) already have strong coverage; the gaps are in handler integration tests and database query tests.

**Tech Stack:** Go 1.24, PostgreSQL 16, `net/http/httptest`, `testing`, `github.com/lib/pq`, Docker Compose

---

## Testing Gap Analysis

| Package | Current Tests | Gap |
|---------|--------------|-----|
| `internal/calc` | 36 tests, all algorithms covered | None - well tested |
| `internal/weather` | 7 tests, parsing + conversions | None - well tested |
| `internal/handler` | 4 tests (health, version, query helpers) | Missing: page handlers, CRUD handlers, JSON API handlers |
| `internal/db` | 0 tests | Missing: all CRUD operations, migrations |
| `internal/scheduler` | 0 tests | Missing: calculation orchestration |
| `internal/model` | 0 tests (type definitions only) | None needed - pure type defs |
| Templates | 0 tests | Missing: template rendering validation |

**Priority:** Handler integration tests > DB query tests > Template smoke tests > Scheduler tests

---

### Task 1: Add Test Helper for In-Memory Handler Testing

**Files:**
- Create: `go-app/internal/handler/testutil_test.go`

**Step 1: Write the test helper file**

This file provides a `newTestServer()` function that creates a `Server` with nil DB and parsed templates, for testing handlers that don't need a database (page rendering, routing, middleware).

```go
package handler

import (
	"html/template"
	"net/http"
	"net/http/httptest"
)

// newTestServer creates a Server with no DB and minimal template stubs.
func newTestServer() *Server {
	funcMap := template.FuncMap{
		"formatDate":     func(interface{}) string { return "2025-01-01" },
		"formatDateTime": func(interface{}) string { return "Jan 01, 2025 12:00 PM" },
		"formatFloat":    func(f float64, p int) string { return "0.00" },
		"formatFloatPtr": func(f interface{}, p int) string { return "-" },
		"pctToStr":       func(f float64) string { return "-" },
		"statusBadge":    func(s string) template.HTML { return template.HTML(s) },
		"json":           func(v interface{}) template.JS { return "null" },
		"nullStr":        func(interface{}) string { return "" },
		"deref":          func(interface{}) int { return 0 },
		"derefTime":      func(interface{}) string { return "" },
		"mul":            func(a, b float64) float64 { return a * b },
		"seq":            func(n int) []int { return nil },
	}
	tmpl := template.Must(template.New("").Funcs(funcMap).Parse(`{{define "layout.html"}}OK{{end}}{{define "dashboard.html"}}dashboard{{end}}{{define "lawns.html"}}lawns{{end}}{{define "products.html"}}products{{end}}{{define "applications.html"}}apps{{end}}{{define "gdd.html"}}gdd{{end}}{{define "water.html"}}water{{end}}{{define "reports.html"}}reports{{end}}{{define "admin.html"}}admin{{end}}`))
	return &Server{Templates: tmpl}
}

// doGet is a helper that makes a GET request and returns the recorder.
func doGet(handler http.HandlerFunc, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("GET", path, nil)
	w := httptest.NewRecorder()
	handler(w, req)
	return w
}
```

**Step 2: Verify it compiles**

Run: `cd /Users/aaron/Documents/code_repos/TurfTrack/go-app && go build ./internal/handler/`
Expected: No errors

**Step 3: Commit**

```bash
git add go-app/internal/handler/testutil_test.go
git commit -m "test: add handler test helpers for unit testing"
```

---

### Task 2: Add Handler Route Tests (Page Rendering)

**Files:**
- Create: `go-app/internal/handler/pages_test.go`

**Step 1: Write failing tests for all page handlers**

These tests verify that every page handler returns 200 OK and renders the layout template when called with nil DB (pages gracefully handle nil DB by returning empty data).

```go
package handler

import (
	"net/http"
	"testing"
)

func TestPageHandlers(t *testing.T) {
	s := newTestServer()

	tests := []struct {
		name    string
		path    string
		handler http.HandlerFunc
	}{
		{"dashboard", "/", s.handleDashboard},
		{"lawns", "/lawns", s.handleLawns},
		{"products", "/products", s.handleProducts},
		{"applications", "/applications", s.handleApplications},
		{"gdd", "/gdd", s.handleGDD},
		{"water", "/water", s.handleWater},
		{"reports", "/reports", s.handleReports},
		{"admin", "/admin", s.handleAdmin},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := doGet(tt.handler, tt.path)
			if w.Code != http.StatusOK {
				t.Errorf("%s: expected 200, got %d. Body: %s", tt.name, w.Code, w.Body.String())
			}
		})
	}
}

func TestDashboard404ForNonRootPaths(t *testing.T) {
	s := newTestServer()
	w := doGet(s.handleDashboard, "/nonexistent")
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404 for /nonexistent, got %d", w.Code)
	}
}
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/aaron/Documents/code_repos/TurfTrack/go-app && go test ./internal/handler/ -run TestPageHandlers -v`
Expected: FAIL (page handlers call dbpkg functions which will panic on nil DB)

**Step 3: Fix page handlers to handle nil DB gracefully**

In `handler.go`, each page handler calls `dbpkg.ListLocations(s.DB)` etc. When `s.DB` is nil, `db.Query()` panics. Add nil-DB guards to each page handler. Modify `handler.go`:

Add a helper method at the top of the page handlers section:

```go
func (s *Server) dbAvailable() bool {
	return s.DB != nil
}
```

Then wrap each page handler's DB calls. Example for `handleDashboard`:

```go
func (s *Server) handleDashboard(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	var locs []model.Location
	var lawns []model.Lawn
	if s.dbAvailable() {
		locs, _ = dbpkg.ListLocations(s.DB)
		lawns, _ = dbpkg.ListLawns(s.DB)
	}
	data := map[string]interface{}{
		"Page":      "dashboard",
		"Locations": locs,
		"Lawns":     lawns,
	}
	s.render(w, "layout.html", data)
}
```

Apply the same `if s.dbAvailable()` guard to: `handleLawns`, `handleProducts`, `handleApplications`, `handleGDD`, `handleWater`, `handleReports`, `handleAdmin`.

**Step 4: Run tests to verify they pass**

Run: `cd /Users/aaron/Documents/code_repos/TurfTrack/go-app && go test ./internal/handler/ -run TestPage -v`
Expected: PASS

**Step 5: Commit**

```bash
git add go-app/internal/handler/pages_test.go go-app/internal/handler/handler.go
git commit -m "test: add page handler tests, add nil-DB guards"
```

---

### Task 3: Add JSON API Handler Tests

**Files:**
- Create: `go-app/internal/handler/api_test.go`

**Step 1: Write failing tests for JSON API handlers**

```go
package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAPIWeatherRequiresLocationID(t *testing.T) {
	s := newTestServer()
	// Without proper path value, should return 400
	req := httptest.NewRequest("GET", "/api/weather/abc", nil)
	w := httptest.NewRecorder()
	s.apiWeather(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for non-numeric ID, got %d", w.Code)
	}
}

func TestAPIEndpointsReturnJSON(t *testing.T) {
	s := newTestServer()
	endpoints := []struct {
		name    string
		handler http.HandlerFunc
	}{
		{"version", s.handleVersion},
	}
	for _, tt := range endpoints {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			w := httptest.NewRecorder()
			tt.handler(w, req)
			ct := w.Header().Get("Content-Type")
			if ct != "application/json" {
				t.Errorf("%s: Content-Type = %q, want application/json", tt.name, ct)
			}
		})
	}
}

func TestHealthEndpointWithNilDB(t *testing.T) {
	s := newTestServer()
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	s.handleHealth(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}
	ct := w.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
}
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/aaron/Documents/code_repos/TurfTrack/go-app && go test ./internal/handler/ -run TestAPI -v`
Expected: FAIL (apiWeather uses `pathID` which needs Go 1.22+ `r.PathValue`, returns different error without mux routing)

**Step 3: Fix API handler to return proper error for invalid IDs**

The `apiWeather` handler calls `pathID(r, "locationID")` which calls `r.PathValue("locationID")`. In test context without a mux, `PathValue` returns empty string, so `strconv.Atoi("")` returns an error. The handler already checks for this error and returns 400. The test just needs the right setup. Update test to match actual behavior:

```go
func TestAPIWeatherRequiresLocationID(t *testing.T) {
	s := newTestServer()
	req := httptest.NewRequest("GET", "/api/weather/abc", nil)
	w := httptest.NewRecorder()
	s.apiWeather(w, req)
	// Without mux routing, PathValue returns "", Atoi fails, returns 400
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid path, got %d", w.Code)
	}
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/aaron/Documents/code_repos/TurfTrack/go-app && go test ./internal/handler/ -run TestAPI -v`
Expected: PASS

**Step 5: Commit**

```bash
git add go-app/internal/handler/api_test.go
git commit -m "test: add JSON API handler tests"
```

---

### Task 4: Add Middleware Tests

**Files:**
- Modify: `go-app/internal/handler/handler_test.go`

**Step 1: Write test for security headers and routing**

Append to `handler_test.go`:

```go
func TestMiddlewareSecurityHeaders(t *testing.T) {
	s := newTestServer()
	mux := s.Routes()
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if v := w.Header().Get("X-Content-Type-Options"); v != "nosniff" {
		t.Errorf("X-Content-Type-Options = %q, want nosniff", v)
	}
	if v := w.Header().Get("X-Frame-Options"); v != "DENY" {
		t.Errorf("X-Frame-Options = %q, want DENY", v)
	}
}

func TestRoutesRegistered(t *testing.T) {
	s := newTestServer()
	mux := s.Routes()

	paths := []struct {
		method string
		path   string
		want   int
	}{
		{"GET", "/health", 503},        // no DB = 503
		{"GET", "/api/v1/version", 200},
	}
	for _, tt := range paths {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, req)
			if w.Code != tt.want {
				t.Errorf("%s %s = %d, want %d", tt.method, tt.path, w.Code, tt.want)
			}
		})
	}
}
```

**Step 2: Run tests to verify they pass**

Run: `cd /Users/aaron/Documents/code_repos/TurfTrack/go-app && go test ./internal/handler/ -run TestMiddleware -v && go test ./internal/handler/ -run TestRoutes -v`
Expected: PASS (these test the wired-up mux, which should work)

**Step 3: Commit**

```bash
git add go-app/internal/handler/handler_test.go
git commit -m "test: add middleware security header and route registration tests"
```

---

### Task 5: Add Integration Test Infrastructure (Docker + Test DB)

**Files:**
- Create: `go-app/internal/db/db_test.go`

**Step 1: Write integration test for database connection and migrations**

These tests require a running PostgreSQL instance. They use build tags to separate from unit tests.

```go
//go:build integration

package db

import (
	"database/sql"
	"os"
	"testing"

	_ "github.com/lib/pq"
)

func testDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost port=5432 user=turftrack password=turftrack dbname=turftrack_test sslmode=disable"
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Skipf("cannot connect to test database: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Skipf("cannot ping test database: %v", err)
	}
	// Clean slate
	db.Exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
	return db
}

func TestRunMigrations(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	err := RunMigrations(db, "../../migrations")
	if err != nil {
		t.Fatalf("RunMigrations failed: %v", err)
	}

	// Verify tables exist
	tables := []string{"locations", "lawns", "daily_weather", "gdd_models", "gdd_values",
		"products", "applications", "disease_pressure", "growth_potential",
		"irrigation_entries", "weekly_water_summaries", "weed_species", "weed_pressure",
		"task_status", "schema_migrations"}
	for _, table := range tables {
		var exists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name=$1)", table).Scan(&exists)
		if err != nil || !exists {
			t.Errorf("table %s does not exist after migration", table)
		}
	}
}

func TestRunMigrationsIdempotent(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	// Run twice - should not error
	if err := RunMigrations(db, "../../migrations"); err != nil {
		t.Fatalf("first RunMigrations failed: %v", err)
	}
	if err := RunMigrations(db, "../../migrations"); err != nil {
		t.Fatalf("second RunMigrations failed: %v", err)
	}
}
```

**Step 2: Run to verify test is skipped (no test DB running)**

Run: `cd /Users/aaron/Documents/code_repos/TurfTrack/go-app && go test ./internal/db/ -tags integration -v -count=1`
Expected: SKIP (cannot connect to test database)

**Step 3: Run with Docker test DB to verify pass**

Run:
```bash
docker run -d --name turftrack-test-db -e POSTGRES_USER=turftrack -e POSTGRES_PASSWORD=turftrack -e POSTGRES_DB=turftrack_test -p 5433:5432 postgres:16-alpine
sleep 3
cd /Users/aaron/Documents/code_repos/TurfTrack/go-app && TEST_DATABASE_URL="host=localhost port=5433 user=turftrack password=turftrack dbname=turftrack_test sslmode=disable" go test ./internal/db/ -tags integration -v -count=1
docker rm -f turftrack-test-db
```
Expected: PASS

**Step 4: Commit**

```bash
git add go-app/internal/db/db_test.go
git commit -m "test: add integration tests for database migrations"
```

---

### Task 6: Add Integration Tests for CRUD Queries

**Files:**
- Create: `go-app/internal/db/queries_test.go`

**Step 1: Write integration tests for all CRUD operations**

```go
//go:build integration

package db

import (
	"testing"
	"time"

	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/model"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db := testDB(t)
	if err := RunMigrations(db, "../../migrations"); err != nil {
		t.Fatalf("migration failed: %v", err)
	}
	return db
}

func TestLocationCRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	// Create
	loc, err := CreateLocation(db, "Test Yard", 32.7767, -96.7970)
	if err != nil {
		t.Fatalf("CreateLocation: %v", err)
	}
	if loc.ID == 0 {
		t.Error("expected non-zero ID")
	}
	if loc.Name != "Test Yard" {
		t.Errorf("Name = %q, want Test Yard", loc.Name)
	}

	// Get
	got, err := GetLocation(db, loc.ID)
	if err != nil || got == nil {
		t.Fatalf("GetLocation: %v", err)
	}
	if got.Name != "Test Yard" {
		t.Errorf("GetLocation Name = %q", got.Name)
	}

	// List
	locs, err := ListLocations(db)
	if err != nil || len(locs) != 1 {
		t.Fatalf("ListLocations: got %d, err: %v", len(locs), err)
	}

	// GetOrCreate (existing)
	existing, err := GetOrCreateLocation(db, 32.7767, -96.7970)
	if err != nil {
		t.Fatalf("GetOrCreateLocation existing: %v", err)
	}
	if existing.ID != loc.ID {
		t.Errorf("expected same ID %d, got %d", loc.ID, existing.ID)
	}
}

func TestLawnCRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	loc, _ := CreateLocation(db, "Lawn Loc", 33.0, -97.0)

	// Create
	lawn, err := CreateLawn(db, "Front Yard", 5000, model.GrassTypeCold, "nice lawn",
		model.Freq24h, "America/Chicago", true, loc.ID)
	if err != nil {
		t.Fatalf("CreateLawn: %v", err)
	}
	if lawn.ID == 0 || lawn.Name != "Front Yard" {
		t.Errorf("unexpected lawn: %+v", lawn)
	}

	// List
	lawns, err := ListLawns(db)
	if err != nil || len(lawns) != 1 {
		t.Fatalf("ListLawns: got %d, err: %v", len(lawns), err)
	}
	if lawns[0].Location == nil {
		t.Error("expected joined Location to be non-nil")
	}

	// Get
	got, err := GetLawn(db, lawn.ID)
	if err != nil || got == nil {
		t.Fatalf("GetLawn: %v", err)
	}

	// Update
	updated, err := UpdateLawn(db, lawn.ID, "Back Yard", 3000, model.GrassTypeWarm, "",
		model.Freq24h, "America/Chicago", false, loc.ID)
	if err != nil {
		t.Fatalf("UpdateLawn: %v", err)
	}
	if updated.Name != "Back Yard" {
		t.Errorf("Name = %q after update", updated.Name)
	}

	// Delete
	if err := DeleteLawn(db, lawn.ID); err != nil {
		t.Fatalf("DeleteLawn: %v", err)
	}
	deleted, _ := GetLawn(db, lawn.ID)
	if deleted != nil {
		t.Error("lawn should be deleted")
	}
}

func TestProductCRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	p := &model.Product{Name: "Milorganite", NPct: 6, PPct: 4, KPct: 0, FePct: 2.5}
	created, err := CreateProduct(db, p)
	if err != nil {
		t.Fatalf("CreateProduct: %v", err)
	}
	if created.ID == 0 {
		t.Error("expected non-zero ID")
	}

	products, err := ListProducts(db)
	if err != nil || len(products) != 1 {
		t.Fatalf("ListProducts: got %d, err: %v", len(products), err)
	}

	got, err := GetProduct(db, created.ID)
	if err != nil || got == nil {
		t.Fatalf("GetProduct: %v", err)
	}
	if got.NPct != 6 {
		t.Errorf("NPct = %v, want 6", got.NPct)
	}

	if err := DeleteProduct(db, created.ID); err != nil {
		t.Fatalf("DeleteProduct: %v", err)
	}
}

func TestApplicationCRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	loc, _ := CreateLocation(db, "App Loc", 34.0, -98.0)
	lawn, _ := CreateLawn(db, "App Lawn", 5000, model.GrassTypeCold, "", model.Freq24h, "UTC", true, loc.ID)
	p := &model.Product{Name: "Test Product", NPct: 10}
	product, _ := CreateProduct(db, p)

	app := &model.Application{
		LawnID:          lawn.ID,
		ProductID:       product.ID,
		ApplicationDate: time.Now().Truncate(24 * time.Hour),
		AmountPerArea:   4.0,
		AreaUnit:        1000,
		Unit:            "lbs",
		Status:          model.AppCompleted,
	}
	created, err := CreateApplication(db, app)
	if err != nil {
		t.Fatalf("CreateApplication: %v", err)
	}
	if created.ID == 0 {
		t.Error("expected non-zero ID")
	}

	apps, err := ListApplications(db, nil)
	if err != nil || len(apps) != 1 {
		t.Fatalf("ListApplications: got %d, err: %v", len(apps), err)
	}

	// Filter by lawn
	filtered, err := ListApplications(db, &lawn.ID)
	if err != nil || len(filtered) != 1 {
		t.Fatalf("ListApplications filtered: got %d", len(filtered))
	}

	if err := DeleteApplication(db, created.ID); err != nil {
		t.Fatalf("DeleteApplication: %v", err)
	}
}

func TestGDDModelCRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	loc, _ := CreateLocation(db, "GDD Loc", 35.0, -99.0)

	m := &model.GDDModel{
		LocationID:       loc.ID,
		Name:             "Crabgrass Preventer",
		BaseTemp:         50,
		Unit:             model.TempUnitF,
		StartDate:        time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
		Threshold:        1000,
		ResetOnThreshold: false,
	}
	created, err := CreateGDDModel(db, m)
	if err != nil {
		t.Fatalf("CreateGDDModel: %v", err)
	}

	models, err := ListGDDModels(db, &loc.ID)
	if err != nil || len(models) != 1 {
		t.Fatalf("ListGDDModels: got %d, err: %v", len(models), err)
	}

	if err := DeleteGDDModel(db, created.ID); err != nil {
		t.Fatalf("DeleteGDDModel: %v", err)
	}
}

func TestIrrigationCRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	loc, _ := CreateLocation(db, "Irrig Loc", 36.0, -100.0)
	lawn, _ := CreateLawn(db, "Irrig Lawn", 5000, model.GrassTypeCold, "", model.Freq24h, "UTC", true, loc.ID)

	e := &model.IrrigationEntry{
		LawnID:   lawn.ID,
		Date:     time.Now().Truncate(24 * time.Hour),
		Amount:   0.5,
		Duration: 30,
		Source:   model.IrrigationManual,
	}
	created, err := CreateIrrigationEntry(db, e)
	if err != nil {
		t.Fatalf("CreateIrrigationEntry: %v", err)
	}

	entries, err := ListIrrigationEntries(db, lawn.ID, nil, nil)
	if err != nil || len(entries) != 1 {
		t.Fatalf("ListIrrigationEntries: got %d", len(entries))
	}

	if err := DeleteIrrigationEntry(db, created.ID); err != nil {
		t.Fatalf("DeleteIrrigationEntry: %v", err)
	}
}

func TestTaskStatusCRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	locID := 0 // not linking to a real location
	err := CreateTaskStatus(db, "test-task-1", "test_run", nil)
	if err != nil {
		t.Fatalf("CreateTaskStatus: %v", err)
	}
	_ = locID

	result := "done"
	err = UpdateTaskStatus(db, "test-task-1", model.TaskSuccess, &result, nil)
	if err != nil {
		t.Fatalf("UpdateTaskStatus: %v", err)
	}

	tasks, err := ListTaskStatuses(db, 10)
	if err != nil || len(tasks) != 1 {
		t.Fatalf("ListTaskStatuses: got %d, err: %v", len(tasks), err)
	}
	if tasks[0].Status != model.TaskSuccess {
		t.Errorf("Status = %q, want success", tasks[0].Status)
	}
}
```

**Step 2: Run to verify tests are skipped without DB**

Run: `cd /Users/aaron/Documents/code_repos/TurfTrack/go-app && go test ./internal/db/ -tags integration -v -count=1`
Expected: SKIP

**Step 3: Run with Docker test DB to verify pass**

Run:
```bash
docker run -d --name turftrack-test-db -e POSTGRES_USER=turftrack -e POSTGRES_PASSWORD=turftrack -e POSTGRES_DB=turftrack_test -p 5433:5432 postgres:16-alpine
sleep 3
cd /Users/aaron/Documents/code_repos/TurfTrack/go-app && TEST_DATABASE_URL="host=localhost port=5433 user=turftrack password=turftrack dbname=turftrack_test sslmode=disable" go test ./internal/db/ -tags integration -v -count=1
docker rm -f turftrack-test-db
```
Expected: PASS

**Step 4: Commit**

```bash
git add go-app/internal/db/queries_test.go
git commit -m "test: add integration tests for all CRUD operations"
```

---

### Task 7: Add Weather Upsert Integration Test

**Files:**
- Modify: `go-app/internal/db/queries_test.go`

**Step 1: Add weather upsert test to queries_test.go**

Append to `queries_test.go`:

```go
func TestWeatherUpsert(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	loc, _ := CreateLocation(db, "Weather Loc", 37.0, -101.0)

	day := weather.DailyData{
		Date:                     time.Date(2025, 6, 15, 0, 0, 0, 0, time.UTC),
		TemperatureMaxC:          30,
		TemperatureMinC:          20,
		PrecipitationMM:          5.0,
		PrecipitationProbability: 40,
		WindSpeedMaxMs:           3.5,
		WindGustsMaxMs:           7.0,
		WindDirectionDeg:         180,
		ET0MM:                    4.0,
	}

	// Insert historical
	err := UpsertDailyWeather(db, loc.ID, day, model.WeatherHistorical)
	if err != nil {
		t.Fatalf("UpsertDailyWeather historical: %v", err)
	}

	// Upsert same day (should update)
	day.TemperatureMaxC = 32
	err = UpsertDailyWeather(db, loc.ID, day, model.WeatherHistorical)
	if err != nil {
		t.Fatalf("UpsertDailyWeather update: %v", err)
	}

	// Verify only one record
	data, err := GetWeatherForLocation(db, loc.ID, nil, nil)
	if err != nil {
		t.Fatalf("GetWeatherForLocation: %v", err)
	}
	if len(data) != 1 {
		t.Fatalf("expected 1 weather record, got %d", len(data))
	}
	if data[0].TemperatureMaxC != 32 {
		t.Errorf("TempMaxC = %v, want 32 (should be updated)", data[0].TemperatureMaxC)
	}
}
```

Also add import for `weather` package at top of file:

```go
import (
	"database/sql"
	"testing"
	"time"

	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/model"
	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/weather"
)
```

**Step 2: Run with Docker test DB**

Run: same docker setup + `go test ./internal/db/ -tags integration -run TestWeatherUpsert -v -count=1`
Expected: PASS

**Step 3: Commit**

```bash
git add go-app/internal/db/queries_test.go
git commit -m "test: add weather upsert integration test"
```

---

### Task 8: Add Docker Build and Startup Smoke Test

**Files:**
- Create: `go-app/scripts/test-docker.sh`

**Step 1: Write the smoke test script**

```bash
#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=== Building Docker image ==="
docker compose build

echo "=== Starting services ==="
docker compose up -d

echo "=== Waiting for app to be ready ==="
for i in $(seq 1 30); do
    if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
        echo "App is ready!"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "FAIL: App not ready after 30s"
        docker compose logs app
        docker compose down -v
        exit 1
    fi
    sleep 1
done

echo "=== Testing endpoints ==="
# Health
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health)
[ "$STATUS" = "200" ] && echo "PASS: /health -> $STATUS" || { echo "FAIL: /health -> $STATUS"; exit 1; }

# Version
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/version)
[ "$STATUS" = "200" ] && echo "PASS: /api/v1/version -> $STATUS" || { echo "FAIL: /api/v1/version -> $STATUS"; exit 1; }

# Pages
for page in "/" "/lawns" "/products" "/applications" "/gdd" "/water" "/reports" "/admin"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080${page}")
    [ "$STATUS" = "200" ] && echo "PASS: $page -> $STATUS" || { echo "FAIL: $page -> $STATUS"; exit 1; }
done

echo "=== Cleaning up ==="
docker compose down -v

echo "=== All smoke tests passed ==="
```

**Step 2: Make it executable and run**

Run:
```bash
chmod +x /Users/aaron/Documents/code_repos/TurfTrack/go-app/scripts/test-docker.sh
cd /Users/aaron/Documents/code_repos/TurfTrack/go-app && ./scripts/test-docker.sh
```
Expected: All smoke tests pass

**Step 3: Commit**

```bash
git add go-app/scripts/test-docker.sh
git commit -m "test: add Docker build and endpoint smoke test"
```

---

### Task 9: Run Full Test Suite and Verify

**Files:** None (verification only)

**Step 1: Run all unit tests**

Run: `cd /Users/aaron/Documents/code_repos/TurfTrack/go-app && go test ./... -v -count=1`
Expected: All PASS

**Step 2: Run integration tests**

Run:
```bash
docker run -d --name turftrack-test-db -e POSTGRES_USER=turftrack -e POSTGRES_PASSWORD=turftrack -e POSTGRES_DB=turftrack_test -p 5433:5432 postgres:16-alpine
sleep 3
cd /Users/aaron/Documents/code_repos/TurfTrack/go-app && TEST_DATABASE_URL="host=localhost port=5433 user=turftrack password=turftrack dbname=turftrack_test sslmode=disable" go test ./... -tags integration -v -count=1
docker rm -f turftrack-test-db
```
Expected: All PASS

**Step 3: Run Docker smoke tests**

Run: `cd /Users/aaron/Documents/code_repos/TurfTrack/go-app && ./scripts/test-docker.sh`
Expected: All smoke tests pass

**Step 4: Verify go vet and build**

Run:
```bash
cd /Users/aaron/Documents/code_repos/TurfTrack/go-app && go vet ./...
go build ./...
```
Expected: No errors, no warnings

**Step 5: Commit final state**

```bash
git add -A
git commit -m "chore: verify all tests pass after Go+HTMX refactor"
```

---

## Test Coverage Summary After Plan

| Package | Before | After |
|---------|--------|-------|
| `internal/calc` | 36 tests | 36 tests (unchanged, complete) |
| `internal/weather` | 7 tests | 7 tests (unchanged, complete) |
| `internal/handler` | 4 tests | ~15 tests (pages, API, middleware, routing) |
| `internal/db` | 0 tests | ~10 integration tests (all CRUD + migrations + upserts) |
| `internal/scheduler` | 0 tests | 0 tests (tested indirectly via Docker smoke test) |
| Docker smoke | 0 tests | 10 endpoint checks |
| **Total** | **47 tests** | **~68 unit + ~10 integration + 10 smoke** |

## Running Tests Quick Reference

```bash
# Unit tests (no external deps)
cd go-app && go test ./... -v

# Integration tests (needs test Postgres)
cd go-app && TEST_DATABASE_URL="..." go test ./... -tags integration -v

# Docker smoke test (needs Docker)
cd go-app && ./scripts/test-docker.sh

# Static analysis
cd go-app && go vet ./...
```

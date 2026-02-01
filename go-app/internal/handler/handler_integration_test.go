//go:build integration

package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	_ "github.com/lib/pq"

	dbpkg "github.com/RunOnYourOwn/TurfTrack/go-app/internal/db"
	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/model"
	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/weather"
)

// ---------------------------------------------------------------------------
// Test infrastructure helpers
// ---------------------------------------------------------------------------

// testDBForHandler returns a clean database with migrations applied.
func testDBForHandler(t *testing.T) *sql.DB {
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
	db.Exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
	if err := dbpkg.RunMigrations(db, "../../migrations"); err != nil {
		t.Fatalf("RunMigrations failed: %v", err)
	}
	return db
}

// newIntegrationServer creates a Server wired to a real DB with stub templates.
func newIntegrationServer(t *testing.T, db *sql.DB) *Server {
	t.Helper()
	s := newTestServer()
	s.DB = db
	return s
}

// seedLocation inserts a test location.
func seedLocation(t *testing.T, db *sql.DB) *model.Location {
	t.Helper()
	loc, err := dbpkg.CreateLocation(db, "Test Location", 35.0, -85.0)
	if err != nil {
		t.Fatalf("seedLocation: %v", err)
	}
	return loc
}

// seedLawn inserts a test lawn at the given location.
func seedLawn(t *testing.T, db *sql.DB, locID int) *model.Lawn {
	t.Helper()
	lawn, err := dbpkg.CreateLawn(db, "Test Lawn", 5000, model.GrassTypeCold, "notes", true, locID)
	if err != nil {
		t.Fatalf("seedLawn: %v", err)
	}
	return lawn
}

// seedProduct inserts a 24-0-4 test fertilizer.
func seedProduct(t *testing.T, db *sql.DB) *model.Product {
	t.Helper()
	p := &model.Product{Name: "24-0-4 Fert", NPct: 24.0, PPct: 0.0, KPct: 4.0}
	created, err := dbpkg.CreateProduct(db, p)
	if err != nil {
		t.Fatalf("seedProduct: %v", err)
	}
	return created
}

// postForm sends a POST with form-encoded body through the mux.
func postForm(mux http.Handler, path string, vals url.Values) *httptest.ResponseRecorder {
	body := vals.Encode()
	req := httptest.NewRequest("POST", path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	return w
}

// putForm sends a PUT with form-encoded body through the mux.
func putForm(mux http.Handler, path string, vals url.Values) *httptest.ResponseRecorder {
	body := vals.Encode()
	req := httptest.NewRequest("PUT", path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	return w
}

// deleteReq sends a DELETE through the mux.
func deleteReq(mux http.Handler, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("DELETE", path, nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	return w
}

// getJSON sends a GET and returns the recorder.
func getJSON(mux http.Handler, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("GET", path, nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	return w
}

// floatClose checks if two floats are within tolerance.
func floatClose(a, b, tol float64) bool {
	return math.Abs(a-b) < tol
}

// requireFloat helper extracts *float64 or fails.
func requireFloat(t *testing.T, f *float64, name string) float64 {
	t.Helper()
	if f == nil {
		t.Fatalf("%s is nil, expected a value", name)
	}
	return *f
}

// ---------------------------------------------------------------------------
// Task 3: Application CRUD Integration Tests
// ---------------------------------------------------------------------------

func TestCreateApplication_NutrientCalc(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)
	mux := s.Routes()

	loc := seedLocation(t, db)
	lawn := seedLawn(t, db, loc.ID)
	prod := seedProduct(t, db) // 24-0-4

	vals := url.Values{
		"lawn_id":          {fmt.Sprint(lawn.ID)},
		"product_id":       {fmt.Sprint(prod.ID)},
		"application_date": {"2025-06-01"},
		"amount_per_area":  {"4"},
		"area_unit":        {"1000"},
		"unit":             {"lbs"},
		"status":           {"completed"},
	}
	w := postForm(mux, "/applications", vals)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	// Verify the stored application
	apps, err := dbpkg.ListApplications(db, nil, "", "")
	if err != nil {
		t.Fatalf("ListApplications: %v", err)
	}
	if len(apps) != 1 {
		t.Fatalf("expected 1 application, got %d", len(apps))
	}
	a := apps[0]

	// 4 lbs * 24/100 = 0.96 N applied
	nApplied := requireFloat(t, a.NApplied, "NApplied")
	if !floatClose(nApplied, 0.96, 0.001) {
		t.Errorf("NApplied = %f, want 0.96", nApplied)
	}

	// 4 lbs * 4/100 = 0.16 K applied
	kApplied := requireFloat(t, a.KApplied, "KApplied")
	if !floatClose(kApplied, 0.16, 0.001) {
		t.Errorf("KApplied = %f, want 0.16", kApplied)
	}

	// P should be 0.0
	pApplied := requireFloat(t, a.PApplied, "PApplied")
	if !floatClose(pApplied, 0.0, 0.001) {
		t.Errorf("PApplied = %f, want 0.0", pApplied)
	}
}

func TestCreateApplication_OzUnit(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)
	mux := s.Routes()

	loc := seedLocation(t, db)
	lawn := seedLawn(t, db, loc.ID)
	prod := seedProduct(t, db) // 24-0-4

	// 64 oz = 4 lbs, should give same nutrient result as 4 lbs
	vals := url.Values{
		"lawn_id":          {fmt.Sprint(lawn.ID)},
		"product_id":       {fmt.Sprint(prod.ID)},
		"application_date": {"2025-06-01"},
		"amount_per_area":  {"64"},
		"area_unit":        {"1000"},
		"unit":             {"oz"},
		"status":           {"completed"},
	}
	w := postForm(mux, "/applications", vals)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	apps, _ := dbpkg.ListApplications(db, nil, "", "")
	if len(apps) != 1 {
		t.Fatalf("expected 1 application, got %d", len(apps))
	}

	nApplied := requireFloat(t, apps[0].NApplied, "NApplied")
	if !floatClose(nApplied, 0.96, 0.001) {
		t.Errorf("NApplied = %f, want 0.96 (64oz = 4lbs)", nApplied)
	}
}

func TestUpdateApplication_RecalculatesNutrients(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)
	mux := s.Routes()

	loc := seedLocation(t, db)
	lawn := seedLawn(t, db, loc.ID)
	prod := seedProduct(t, db) // 24-0-4

	// Create with 4 lbs
	vals := url.Values{
		"lawn_id":          {fmt.Sprint(lawn.ID)},
		"product_id":       {fmt.Sprint(prod.ID)},
		"application_date": {"2025-06-01"},
		"amount_per_area":  {"4"},
		"area_unit":        {"1000"},
		"unit":             {"lbs"},
		"status":           {"completed"},
	}
	postForm(mux, "/applications", vals)

	apps, _ := dbpkg.ListApplications(db, nil, "", "")
	if len(apps) != 1 {
		t.Fatalf("expected 1 application, got %d", len(apps))
	}
	appID := apps[0].ID

	// Update to 8 lbs — N should double
	vals.Set("amount_per_area", "8")
	w := putForm(mux, fmt.Sprintf("/applications/%d", appID), vals)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	apps, _ = dbpkg.ListApplications(db, nil, "", "")
	nApplied := requireFloat(t, apps[0].NApplied, "NApplied")
	if !floatClose(nApplied, 1.92, 0.001) {
		t.Errorf("NApplied = %f, want 1.92 (8 lbs * 24%%)", nApplied)
	}
}

// ---------------------------------------------------------------------------
// Task 4: Lawn Location Management Integration Tests
// ---------------------------------------------------------------------------

func TestCreateLawn_WithExistingLocation(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)
	mux := s.Routes()

	loc := seedLocation(t, db)

	vals := url.Values{
		"name":            {"Front Yard"},
		"area":            {"5000"},
		"grass_type":      {string(model.GrassTypeCold)},
		"location_id":     {fmt.Sprint(loc.ID)},
		"weather_enabled": {"on"},
	}
	w := postForm(mux, "/lawns", vals)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	lawns, _ := dbpkg.ListLawns(db)
	if len(lawns) != 1 {
		t.Fatalf("expected 1 lawn, got %d", len(lawns))
	}
	if lawns[0].LocationID != loc.ID {
		t.Errorf("LocationID = %d, want %d", lawns[0].LocationID, loc.ID)
	}
}

func TestCreateLawn_WithNewLocation(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)
	mux := s.Routes()

	vals := url.Values{
		"name":          {"Back Yard"},
		"area":          {"3000"},
		"grass_type":    {string(model.GrassTypeWarm)},
		"location_id":   {"new"},
		"latitude":      {"36.0"},
		"longitude":     {"-86.0"},
		"location_name": {"New Loc"},
	}
	w := postForm(mux, "/lawns", vals)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	locs, _ := dbpkg.ListLocations(db)
	if len(locs) != 1 {
		t.Fatalf("expected 1 location, got %d", len(locs))
	}
	if locs[0].Name != "New Loc" {
		t.Errorf("location name = %q, want %q", locs[0].Name, "New Loc")
	}

	lawns, _ := dbpkg.ListLawns(db)
	if len(lawns) != 1 {
		t.Fatalf("expected 1 lawn, got %d", len(lawns))
	}
	if lawns[0].LocationID != locs[0].ID {
		t.Errorf("lawn.LocationID = %d, want %d", lawns[0].LocationID, locs[0].ID)
	}
}

func TestUpdateLawn_LocationChange_CleansOrphan(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)
	mux := s.Routes()

	loc1 := seedLocation(t, db)
	lawn := seedLawn(t, db, loc1.ID)

	// Create a second location
	loc2, _ := dbpkg.CreateLocation(db, "Location 2", 36.0, -86.0)

	// Move lawn to loc2
	vals := url.Values{
		"name":            {lawn.Name},
		"area":            {fmt.Sprintf("%.0f", lawn.Area)},
		"grass_type":      {string(lawn.GrassType)},
		"location_id":     {fmt.Sprint(loc2.ID)},
		"weather_enabled": {"on"},
	}
	w := putForm(mux, fmt.Sprintf("/lawns/%d", lawn.ID), vals)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// loc1 should be deleted (orphaned — no lawns referencing it)
	got, _ := dbpkg.GetLocation(db, loc1.ID)
	if got != nil {
		t.Error("orphaned location should have been deleted")
	}

	// loc2 should still exist
	got2, _ := dbpkg.GetLocation(db, loc2.ID)
	if got2 == nil {
		t.Error("new location should still exist")
	}
}

func TestUpdateLawn_LocationChange_NoOrphanIfShared(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)
	mux := s.Routes()

	loc := seedLocation(t, db)
	lawn1 := seedLawn(t, db, loc.ID)
	// Create a second lawn sharing the same location
	_, _ = dbpkg.CreateLawn(db, "Second Lawn", 3000, model.GrassTypeCold, "", true, loc.ID)

	// Create new location and move lawn1 there
	loc2, _ := dbpkg.CreateLocation(db, "Location 2", 36.0, -86.0)
	vals := url.Values{
		"name":            {lawn1.Name},
		"area":            {fmt.Sprintf("%.0f", lawn1.Area)},
		"grass_type":      {string(lawn1.GrassType)},
		"location_id":     {fmt.Sprint(loc2.ID)},
		"weather_enabled": {"on"},
	}
	putForm(mux, fmt.Sprintf("/lawns/%d", lawn1.ID), vals)

	// loc should survive — still referenced by Second Lawn
	got, _ := dbpkg.GetLocation(db, loc.ID)
	if got == nil {
		t.Error("shared location should NOT be deleted")
	}
}

func TestDeleteLawn_CleansOrphanedLocation(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)
	mux := s.Routes()

	loc := seedLocation(t, db)
	lawn := seedLawn(t, db, loc.ID)

	w := deleteReq(mux, fmt.Sprintf("/lawns/%d", lawn.ID))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	// Location should be deleted
	got, _ := dbpkg.GetLocation(db, loc.ID)
	if got != nil {
		t.Error("orphaned location should have been deleted after lawn delete")
	}
}

// ---------------------------------------------------------------------------
// Task 5: GDD Model & Reset Integration Tests
// ---------------------------------------------------------------------------

func TestCreateGDDModel_TriggersRecalculation(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)
	mux := s.Routes()

	loc := seedLocation(t, db)

	// Seed weather data: one day with tmax=30°C, tmin=18°C
	day := weather.DailyData{
		Date:            time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC),
		TemperatureMaxC: 30.0,
		TemperatureMinC: 18.0,
	}
	if err := dbpkg.UpsertDailyWeather(db, loc.ID, day, model.WeatherHistorical); err != nil {
		t.Fatalf("UpsertDailyWeather: %v", err)
	}

	// Create GDD model starting on 2025-06-01 with base=10°C
	vals := url.Values{
		"location_id": {fmt.Sprint(loc.ID)},
		"name":        {"Test GDD Model"},
		"base_temp":   {"10"},
		"unit":        {string(model.TempUnitC)},
		"start_date":  {"2025-06-01"},
		"threshold":   {"0"},
	}
	w := postForm(mux, "/gdd-models", vals)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	// Verify GDD values were calculated
	models, _ := dbpkg.ListGDDModels(db, &loc.ID)
	if len(models) != 1 {
		t.Fatalf("expected 1 GDD model, got %d", len(models))
	}

	values, _ := dbpkg.GetGDDValues(db, models[0].ID)
	if len(values) == 0 {
		t.Fatal("expected GDD values to be calculated")
	}

	// DailyGDD = max(0, (30+18)/2 - 10) = max(0, 24-10) = 14.0
	if !floatClose(values[0].DailyGDD, 14.0, 0.01) {
		t.Errorf("DailyGDD = %f, want 14.0", values[0].DailyGDD)
	}
	if !floatClose(values[0].CumulativeGDD, 14.0, 0.01) {
		t.Errorf("CumulativeGDD = %f, want 14.0", values[0].CumulativeGDD)
	}
}

func TestDeleteGDDReset_RecalculatesGDD(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)
	mux := s.Routes()

	loc := seedLocation(t, db)

	// Seed 3 days of weather
	for i := 0; i < 3; i++ {
		day := weather.DailyData{
			Date:            time.Date(2025, 6, 1+i, 0, 0, 0, 0, time.UTC),
			TemperatureMaxC: 30.0,
			TemperatureMinC: 18.0,
		}
		if err := dbpkg.UpsertDailyWeather(db, loc.ID, day, model.WeatherHistorical); err != nil {
			t.Fatalf("UpsertDailyWeather: %v", err)
		}
	}

	// Create GDD model
	vals := url.Values{
		"location_id": {fmt.Sprint(loc.ID)},
		"name":        {"Reset Test"},
		"base_temp":   {"10"},
		"unit":        {string(model.TempUnitC)},
		"start_date":  {"2025-06-01"},
		"threshold":   {"0"},
	}
	postForm(mux, "/gdd-models", vals)

	models, _ := dbpkg.ListGDDModels(db, &loc.ID)
	if len(models) != 1 {
		t.Fatalf("expected 1 GDD model, got %d", len(models))
	}
	modelID := models[0].ID

	// Add a manual reset on day 2 (2025-06-02)
	resetVals := url.Values{
		"gdd_model_id": {fmt.Sprint(modelID)},
		"reset_date":   {"2025-06-02"},
	}
	postForm(mux, "/gdd-resets", resetVals)

	// Verify cumulative resets at day 2
	values, _ := dbpkg.GetGDDValues(db, modelID)
	var day2Val *model.GDDValue
	for i := range values {
		if values[i].Date.Format("2006-01-02") == "2025-06-02" {
			day2Val = &values[i]
			break
		}
	}
	if day2Val == nil {
		t.Fatal("missing GDD value for 2025-06-02")
	}
	// After manual reset on day2, cumulative should be just that day's GDD (14.0)
	if !floatClose(day2Val.CumulativeGDD, 14.0, 0.01) {
		t.Errorf("after reset, day2 cumulative = %f, want 14.0", day2Val.CumulativeGDD)
	}

	// Delete the reset
	resets, _ := dbpkg.ListGDDResets(db, modelID)
	if len(resets) == 0 {
		t.Fatal("expected at least one GDD reset")
	}
	w := deleteReq(mux, fmt.Sprintf("/gdd-resets/%d", resets[0].ID))
	if w.Code != http.StatusOK {
		t.Fatalf("delete reset: expected 200, got %d", w.Code)
	}

	// Verify cumulative restored — day2 cumulative should be 28.0 (14+14)
	values, _ = dbpkg.GetGDDValues(db, modelID)
	for i := range values {
		if values[i].Date.Format("2006-01-02") == "2025-06-02" {
			day2Val = &values[i]
			break
		}
	}
	if !floatClose(day2Val.CumulativeGDD, 28.0, 0.01) {
		t.Errorf("after deleting reset, day2 cumulative = %f, want 28.0", day2Val.CumulativeGDD)
	}
}

// ---------------------------------------------------------------------------
// Task 6: Settings, Products, Irrigation, Location, Reports
// ---------------------------------------------------------------------------

func TestSaveSettings_WhitelistOnly(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)
	mux := s.Routes()

	vals := url.Values{
		"weather_update_hour":     {"12"},
		"weather_update_timezone": {"America/New_York"},
		"weather_history_days":    {"30"},
		"malicious_key":           {"should_not_save"},
	}
	w := postForm(mux, "/admin/settings", vals)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	settings, _ := dbpkg.GetAllSettings(db)

	if settings["weather_update_hour"] != "12" {
		t.Errorf("weather_update_hour = %q, want %q", settings["weather_update_hour"], "12")
	}
	if settings["weather_update_timezone"] != "America/New_York" {
		t.Errorf("weather_update_timezone = %q, want %q", settings["weather_update_timezone"], "America/New_York")
	}
	if settings["weather_history_days"] != "30" {
		t.Errorf("weather_history_days = %q, want %q", settings["weather_history_days"], "30")
	}
	if _, exists := settings["malicious_key"]; exists {
		t.Error("malicious_key should not have been saved")
	}
}

func TestCreateProduct_ParsesAllFields(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)
	mux := s.Routes()

	vals := url.Values{
		"name":         {"Super Fert"},
		"n_pct":        {"10.5"},
		"p_pct":        {"2.0"},
		"k_pct":        {"5.0"},
		"fe_pct":       {"0.5"},
		"weight_lbs":   {"50"},
		"cost_per_bag": {"29.99"},
	}
	w := postForm(mux, "/products", vals)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	products, _ := dbpkg.ListProducts(db)
	if len(products) != 1 {
		t.Fatalf("expected 1 product, got %d", len(products))
	}
	p := products[0]

	if p.Name != "Super Fert" {
		t.Errorf("Name = %q, want %q", p.Name, "Super Fert")
	}
	if !floatClose(p.NPct, 10.5, 0.001) {
		t.Errorf("NPct = %f, want 10.5", p.NPct)
	}
	if !floatClose(p.PPct, 2.0, 0.001) {
		t.Errorf("PPct = %f, want 2.0", p.PPct)
	}
	if !floatClose(p.KPct, 5.0, 0.001) {
		t.Errorf("KPct = %f, want 5.0", p.KPct)
	}
	if !floatClose(p.FePct, 0.5, 0.001) {
		t.Errorf("FePct = %f, want 0.5", p.FePct)
	}
	if p.WeightLbs == nil || !floatClose(*p.WeightLbs, 50.0, 0.001) {
		t.Errorf("WeightLbs = %v, want 50.0", p.WeightLbs)
	}
	if p.CostPerBag == nil || !floatClose(*p.CostPerBag, 29.99, 0.001) {
		t.Errorf("CostPerBag = %v, want 29.99", p.CostPerBag)
	}
}

func TestUpdateProduct_UpdatesFields(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)
	mux := s.Routes()

	prod := seedProduct(t, db) // 24-0-4

	vals := url.Values{
		"name":  {"Updated Fert"},
		"n_pct": {"30"},
		"p_pct": {"0"},
		"k_pct": {"4"},
	}
	w := putForm(mux, fmt.Sprintf("/products/%d", prod.ID), vals)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	updated, _ := dbpkg.GetProduct(db, prod.ID)
	if updated.Name != "Updated Fert" {
		t.Errorf("Name = %q, want %q", updated.Name, "Updated Fert")
	}
	if !floatClose(updated.NPct, 30.0, 0.001) {
		t.Errorf("NPct = %f, want 30.0", updated.NPct)
	}
}

func TestCreateIrrigation_DefaultSource(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)
	mux := s.Routes()

	loc := seedLocation(t, db)
	lawn := seedLawn(t, db, loc.ID)

	vals := url.Values{
		"lawn_id":  {fmt.Sprint(lawn.ID)},
		"date":     {"2025-06-01"},
		"amount":   {"0.5"},
		"duration": {"30"},
		// source omitted — should default to MANUAL
	}
	w := postForm(mux, "/irrigation", vals)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	entries, _ := dbpkg.ListIrrigationEntries(db, lawn.ID, nil, nil)
	if len(entries) != 1 {
		t.Fatalf("expected 1 irrigation entry, got %d", len(entries))
	}
	if entries[0].Source != model.IrrigationManual {
		t.Errorf("Source = %q, want %q", entries[0].Source, model.IrrigationManual)
	}
}

func TestCreateLocation_ReturnsJSON(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)
	mux := s.Routes()

	vals := url.Values{
		"name":      {"JSON Location"},
		"latitude":  {"40.0"},
		"longitude": {"-74.0"},
	}
	w := postForm(mux, "/locations", vals)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	ct := w.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}

	var loc model.Location
	if err := json.Unmarshal(w.Body.Bytes(), &loc); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if loc.Name != "JSON Location" {
		t.Errorf("Name = %q, want %q", loc.Name, "JSON Location")
	}
}

func TestReports_NutrientTotals(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)

	loc := seedLocation(t, db)
	lawn := seedLawn(t, db, loc.ID)
	prod := seedProduct(t, db) // 24-0-4

	// Create 2 applications with known nutrients
	for i := 0; i < 2; i++ {
		a := &model.Application{
			LawnID:          lawn.ID,
			ProductID:       prod.ID,
			ApplicationDate: time.Date(2025, 6, 1+i, 0, 0, 0, 0, time.UTC),
			AmountPerArea:   4.0,
			AreaUnit:        1000,
			Unit:            model.UnitLbs,
			Status:          model.AppCompleted,
		}
		n := 0.96
		k := 0.16
		p := 0.0
		a.NApplied = &n
		a.KApplied = &k
		a.PApplied = &p
		dbpkg.CreateApplication(db, a)
	}

	// Create 1 application with nil nutrients (edge case)
	a3 := &model.Application{
		LawnID:          lawn.ID,
		ProductID:       prod.ID,
		ApplicationDate: time.Date(2025, 6, 3, 0, 0, 0, 0, time.UTC),
		AmountPerArea:   0,
		AreaUnit:        1000,
		Unit:            model.UnitLbs,
		Status:          model.AppPlanned,
	}
	dbpkg.CreateApplication(db, a3)

	// Fetch reports page — verify it renders without error
	req := httptest.NewRequest("GET", fmt.Sprintf("/reports?lawn=%d", lawn.ID), nil)
	w := httptest.NewRecorder()
	mux := s.Routes()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

// ---------------------------------------------------------------------------
// Task 7: Backfill Weather Integration Tests
// ---------------------------------------------------------------------------

func TestBackfillWeatherIfNeeded_NoWeatherData(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)

	loc := seedLocation(t, db)

	// Should not crash when no weather data exists
	s.backfillWeatherIfNeeded(loc.ID, time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC))
}

func TestBackfillWeatherIfNeeded_AlreadyCovered(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()
	s := newIntegrationServer(t, db)

	loc := seedLocation(t, db)

	// Seed weather starting 2025-06-01
	day := weather.DailyData{
		Date:            time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC),
		TemperatureMaxC: 30.0,
		TemperatureMinC: 18.0,
	}
	dbpkg.UpsertDailyWeather(db, loc.ID, day, model.WeatherHistorical)

	// Request startDate AFTER minDate — should be a no-op (no mock needed)
	s.backfillWeatherIfNeeded(loc.ID, time.Date(2025, 7, 1, 0, 0, 0, 0, time.UTC))

	// Verify only the one seeded day exists
	data, _ := dbpkg.GetWeatherForLocation(db, loc.ID, nil, nil)
	if len(data) != 1 {
		t.Errorf("expected 1 weather row, got %d", len(data))
	}
}

func TestBackfillWeatherIfNeeded_FetchesGap(t *testing.T) {
	db := testDBForHandler(t)
	defer db.Close()

	loc := seedLocation(t, db)

	// Seed one weather row for 2025-06-10
	existingDay := weather.DailyData{
		Date:            time.Date(2025, 6, 10, 0, 0, 0, 0, time.UTC),
		TemperatureMaxC: 30.0,
		TemperatureMinC: 18.0,
	}
	dbpkg.UpsertDailyWeather(db, loc.ID, existingDay, model.WeatherHistorical)

	// Mock weather server that returns one day of data for the gap
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"daily": map[string]interface{}{
				"time":                           []string{"2025-06-07"},
				"temperature_2m_max":             []float64{28.0},
				"temperature_2m_min":             []float64{16.0},
				"precipitation_sum":              []float64{0},
				"windspeed_10m_max":              []float64{0},
				"windgusts_10m_max":              []float64{0},
				"winddirection_10m_dominant":     []float64{0},
				"et0_fao_evapotranspiration":     []float64{0},
				"relative_humidity_2m_mean":      []float64{60},
				"relative_humidity_2m_max":       []float64{80},
				"relative_humidity_2m_min":       []float64{40},
				"dew_point_2m_max":               []float64{15},
				"dew_point_2m_min":               []float64{10},
				"dew_point_2m_mean":              []float64{12},
				"sunshine_duration":              []float64{3600},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()

	// Inject mock weather client
	s := newIntegrationServer(t, db)
	s.WeatherClient = &weather.Client{
		HTTPClient:     mockServer.Client(),
		ArchiveBaseURL: mockServer.URL,
	}

	// Request backfill from 2025-06-07 — gap is 2025-06-07 to 2025-06-09
	s.backfillWeatherIfNeeded(loc.ID, time.Date(2025, 6, 7, 0, 0, 0, 0, time.UTC))

	// Verify the gap was filled
	data, _ := dbpkg.GetWeatherForLocation(db, loc.ID, nil, nil)
	if len(data) < 2 {
		t.Errorf("expected at least 2 weather rows after backfill, got %d", len(data))
	}

	// Verify the backfilled day exists
	found := false
	for _, d := range data {
		if d.Date.Format("2006-01-02") == "2025-06-07" {
			found = true
			if !floatClose(d.TemperatureMaxC, 28.0, 0.01) {
				t.Errorf("backfilled tmax = %f, want 28.0", d.TemperatureMaxC)
			}
		}
	}
	if !found {
		t.Error("backfilled day 2025-06-07 not found in weather data")
	}
}

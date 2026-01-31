//go:build integration

package db

import (
	"database/sql"
	"testing"
	"time"

	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/model"
	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/weather"
)

// setupTestDB returns a clean database with migrations applied.
func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db := testDB(t)
	if err := RunMigrations(db, "../../migrations"); err != nil {
		t.Fatalf("RunMigrations failed: %v", err)
	}
	return db
}

// createTestLocation is a helper that creates a location for use as a foreign key.
func createTestLocation(t *testing.T, db *sql.DB) *model.Location {
	t.Helper()
	loc, err := CreateLocation(db, "Test Location", 35.0, -85.0)
	if err != nil {
		t.Fatalf("CreateLocation failed: %v", err)
	}
	return loc
}

// createTestLawn is a helper that creates a lawn (and its location) for use as a foreign key.
func createTestLawn(t *testing.T, db *sql.DB) (*model.Location, *model.Lawn) {
	t.Helper()
	loc := createTestLocation(t, db)
	lawn, err := CreateLawn(db, "Test Lawn", 5000, model.GrassTypeCold, "test notes",
		model.Freq24h, "America/New_York", true, loc.ID)
	if err != nil {
		t.Fatalf("CreateLawn failed: %v", err)
	}
	return loc, lawn
}

// createTestProduct is a helper that creates a minimal product.
func createTestProduct(t *testing.T, db *sql.DB) *model.Product {
	t.Helper()
	p := &model.Product{
		Name: "Test Fertilizer",
		NPct: 24.0,
		PPct: 0.0,
		KPct: 4.0,
	}
	created, err := CreateProduct(db, p)
	if err != nil {
		t.Fatalf("CreateProduct failed: %v", err)
	}
	return created
}

func TestLocationCRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	// Create
	loc, err := CreateLocation(db, "Front Yard", 35.1234, -85.5678)
	if err != nil {
		t.Fatalf("CreateLocation failed: %v", err)
	}
	if loc.ID == 0 {
		t.Fatal("expected non-zero ID")
	}
	if loc.Name != "Front Yard" {
		t.Errorf("expected name 'Front Yard', got %q", loc.Name)
	}
	if loc.Latitude != 35.1234 {
		t.Errorf("expected latitude 35.1234, got %f", loc.Latitude)
	}
	if loc.Longitude != -85.5678 {
		t.Errorf("expected longitude -85.5678, got %f", loc.Longitude)
	}

	// Get
	got, err := GetLocation(db, loc.ID)
	if err != nil {
		t.Fatalf("GetLocation failed: %v", err)
	}
	if got == nil {
		t.Fatal("GetLocation returned nil")
	}
	if got.Name != loc.Name {
		t.Errorf("GetLocation name mismatch: %q vs %q", got.Name, loc.Name)
	}

	// Get non-existent
	missing, err := GetLocation(db, 99999)
	if err != nil {
		t.Fatalf("GetLocation for missing ID returned error: %v", err)
	}
	if missing != nil {
		t.Error("expected nil for non-existent location")
	}

	// List
	_, err = CreateLocation(db, "Back Yard", 35.1235, -85.5679)
	if err != nil {
		t.Fatalf("CreateLocation (second) failed: %v", err)
	}
	locs, err := ListLocations(db)
	if err != nil {
		t.Fatalf("ListLocations failed: %v", err)
	}
	if len(locs) < 2 {
		t.Errorf("expected at least 2 locations, got %d", len(locs))
	}

	// GetOrCreate - existing
	existing, err := GetOrCreateLocation(db, 35.1234, -85.5678)
	if err != nil {
		t.Fatalf("GetOrCreateLocation (existing) failed: %v", err)
	}
	if existing.ID != loc.ID {
		t.Errorf("expected existing location ID %d, got %d", loc.ID, existing.ID)
	}

	// GetOrCreate - new
	newLoc, err := GetOrCreateLocation(db, 40.0, -90.0)
	if err != nil {
		t.Fatalf("GetOrCreateLocation (new) failed: %v", err)
	}
	if newLoc.ID == 0 {
		t.Error("expected non-zero ID for new location")
	}
	if newLoc.ID == loc.ID {
		t.Error("expected different ID for new location")
	}
}

func TestLawnCRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	// Create
	lawn, err := CreateLawn(db, "Front Lawn", 5000, model.GrassTypeCold, "some notes",
		model.Freq24h, "America/New_York", true, loc.ID)
	if err != nil {
		t.Fatalf("CreateLawn failed: %v", err)
	}
	if lawn.ID == 0 {
		t.Fatal("expected non-zero lawn ID")
	}
	if lawn.Name != "Front Lawn" {
		t.Errorf("expected name 'Front Lawn', got %q", lawn.Name)
	}
	if lawn.Area != 5000 {
		t.Errorf("expected area 5000, got %f", lawn.Area)
	}
	if lawn.GrassType != model.GrassTypeCold {
		t.Errorf("expected grass type %q, got %q", model.GrassTypeCold, lawn.GrassType)
	}
	if lawn.LocationID != loc.ID {
		t.Errorf("expected location_id %d, got %d", loc.ID, lawn.LocationID)
	}

	// Create with empty notes
	lawn2, err := CreateLawn(db, "Back Lawn", 3000, model.GrassTypeWarm, "",
		model.Freq12h, "America/Chicago", false, loc.ID)
	if err != nil {
		t.Fatalf("CreateLawn (no notes) failed: %v", err)
	}
	if lawn2.Notes.Valid {
		t.Error("expected null notes for empty string")
	}

	// Get
	got, err := GetLawn(db, lawn.ID)
	if err != nil {
		t.Fatalf("GetLawn failed: %v", err)
	}
	if got == nil {
		t.Fatal("GetLawn returned nil")
	}
	if got.Name != "Front Lawn" {
		t.Errorf("GetLawn name mismatch: %q", got.Name)
	}
	if got.Location == nil {
		t.Error("expected joined Location to be populated")
	}

	// Get non-existent
	missing, err := GetLawn(db, 99999)
	if err != nil {
		t.Fatalf("GetLawn for missing ID returned error: %v", err)
	}
	if missing != nil {
		t.Error("expected nil for non-existent lawn")
	}

	// List
	lawns, err := ListLawns(db)
	if err != nil {
		t.Fatalf("ListLawns failed: %v", err)
	}
	if len(lawns) != 2 {
		t.Errorf("expected 2 lawns, got %d", len(lawns))
	}

	// Update
	updated, err := UpdateLawn(db, lawn.ID, "Updated Lawn", 6000, model.GrassTypeWarm, "updated notes",
		model.Freq8h, "America/Denver", false, loc.ID)
	if err != nil {
		t.Fatalf("UpdateLawn failed: %v", err)
	}
	if updated.Name != "Updated Lawn" {
		t.Errorf("expected updated name, got %q", updated.Name)
	}
	if updated.Area != 6000 {
		t.Errorf("expected updated area 6000, got %f", updated.Area)
	}
	if updated.GrassType != model.GrassTypeWarm {
		t.Errorf("expected updated grass type %q, got %q", model.GrassTypeWarm, updated.GrassType)
	}

	// Delete
	err = DeleteLawn(db, lawn2.ID)
	if err != nil {
		t.Fatalf("DeleteLawn failed: %v", err)
	}
	lawnsAfter, err := ListLawns(db)
	if err != nil {
		t.Fatalf("ListLawns after delete failed: %v", err)
	}
	if len(lawnsAfter) != 1 {
		t.Errorf("expected 1 lawn after delete, got %d", len(lawnsAfter))
	}
}

func TestProductCRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	// Create
	weight := 50.0
	cost := 45.99
	p := &model.Product{
		Name:       "Milorganite 6-4-0",
		NPct:       6.0,
		PPct:       4.0,
		KPct:       0.0,
		WeightLbs:  &weight,
		CostPerBag: &cost,
	}
	created, err := CreateProduct(db, p)
	if err != nil {
		t.Fatalf("CreateProduct failed: %v", err)
	}
	if created.ID == 0 {
		t.Fatal("expected non-zero product ID")
	}
	if created.Name != "Milorganite 6-4-0" {
		t.Errorf("expected product name, got %q", created.Name)
	}

	// Get
	got, err := GetProduct(db, created.ID)
	if err != nil {
		t.Fatalf("GetProduct failed: %v", err)
	}
	if got == nil {
		t.Fatal("GetProduct returned nil")
	}
	if got.NPct != 6.0 {
		t.Errorf("expected N pct 6.0, got %f", got.NPct)
	}

	// Get non-existent
	missing, err := GetProduct(db, 99999)
	if err != nil {
		t.Fatalf("GetProduct for missing ID returned error: %v", err)
	}
	if missing != nil {
		t.Error("expected nil for non-existent product")
	}

	// List
	p2 := &model.Product{Name: "Urea 46-0-0", NPct: 46.0}
	_, err = CreateProduct(db, p2)
	if err != nil {
		t.Fatalf("CreateProduct (second) failed: %v", err)
	}
	products, err := ListProducts(db)
	if err != nil {
		t.Fatalf("ListProducts failed: %v", err)
	}
	if len(products) != 2 {
		t.Errorf("expected 2 products, got %d", len(products))
	}

	// Delete
	err = DeleteProduct(db, created.ID)
	if err != nil {
		t.Fatalf("DeleteProduct failed: %v", err)
	}
	productsAfter, err := ListProducts(db)
	if err != nil {
		t.Fatalf("ListProducts after delete failed: %v", err)
	}
	if len(productsAfter) != 1 {
		t.Errorf("expected 1 product after delete, got %d", len(productsAfter))
	}
}

func TestApplicationCRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	loc, lawn := createTestLawn(t, db)
	_ = loc
	product := createTestProduct(t, db)

	// Create
	app := &model.Application{
		LawnID:          lawn.ID,
		ProductID:       product.ID,
		ApplicationDate: time.Now().Truncate(24 * time.Hour),
		AmountPerArea:   4.0,
		AreaUnit:        1000,
		Unit:            model.UnitLbs,
		Status:          model.AppCompleted,
	}
	created, err := CreateApplication(db, app)
	if err != nil {
		t.Fatalf("CreateApplication failed: %v", err)
	}
	if created.ID == 0 {
		t.Fatal("expected non-zero application ID")
	}
	if created.LawnID != lawn.ID {
		t.Errorf("expected lawn_id %d, got %d", lawn.ID, created.LawnID)
	}

	// List (all)
	apps, err := ListApplications(db, nil)
	if err != nil {
		t.Fatalf("ListApplications (all) failed: %v", err)
	}
	if len(apps) != 1 {
		t.Errorf("expected 1 application, got %d", len(apps))
	}

	// List (filtered by lawn)
	lawnID := lawn.ID
	appsFiltered, err := ListApplications(db, &lawnID)
	if err != nil {
		t.Fatalf("ListApplications (filtered) failed: %v", err)
	}
	if len(appsFiltered) != 1 {
		t.Errorf("expected 1 application for lawn, got %d", len(appsFiltered))
	}

	// List (filtered by non-existent lawn)
	noLawn := 99999
	appsEmpty, err := ListApplications(db, &noLawn)
	if err != nil {
		t.Fatalf("ListApplications (empty) failed: %v", err)
	}
	if len(appsEmpty) != 0 {
		t.Errorf("expected 0 applications for non-existent lawn, got %d", len(appsEmpty))
	}

	// Delete
	err = DeleteApplication(db, created.ID)
	if err != nil {
		t.Fatalf("DeleteApplication failed: %v", err)
	}
	appsAfter, err := ListApplications(db, nil)
	if err != nil {
		t.Fatalf("ListApplications after delete failed: %v", err)
	}
	if len(appsAfter) != 0 {
		t.Errorf("expected 0 applications after delete, got %d", len(appsAfter))
	}
}

func TestGDDModelCRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	// Create
	m := &model.GDDModel{
		LocationID:       loc.ID,
		Name:             "Cool Season GDD",
		BaseTemp:         50.0,
		Unit:             model.TempUnitF,
		StartDate:        time.Date(2025, 3, 1, 0, 0, 0, 0, time.UTC),
		Threshold:        500.0,
		ResetOnThreshold: false,
	}
	created, err := CreateGDDModel(db, m)
	if err != nil {
		t.Fatalf("CreateGDDModel failed: %v", err)
	}
	if created.ID == 0 {
		t.Fatal("expected non-zero GDD model ID")
	}
	if created.Name != "Cool Season GDD" {
		t.Errorf("expected name 'Cool Season GDD', got %q", created.Name)
	}

	// List (all)
	models, err := ListGDDModels(db, nil)
	if err != nil {
		t.Fatalf("ListGDDModels (all) failed: %v", err)
	}
	if len(models) != 1 {
		t.Errorf("expected 1 GDD model, got %d", len(models))
	}

	// List (filtered by location)
	locID := loc.ID
	modelsFiltered, err := ListGDDModels(db, &locID)
	if err != nil {
		t.Fatalf("ListGDDModels (filtered) failed: %v", err)
	}
	if len(modelsFiltered) != 1 {
		t.Errorf("expected 1 GDD model for location, got %d", len(modelsFiltered))
	}

	// List (filtered by non-existent location)
	noLoc := 99999
	modelsEmpty, err := ListGDDModels(db, &noLoc)
	if err != nil {
		t.Fatalf("ListGDDModels (empty) failed: %v", err)
	}
	if len(modelsEmpty) != 0 {
		t.Errorf("expected 0 GDD models for non-existent location, got %d", len(modelsEmpty))
	}

	// Delete
	err = DeleteGDDModel(db, created.ID)
	if err != nil {
		t.Fatalf("DeleteGDDModel failed: %v", err)
	}
	modelsAfter, err := ListGDDModels(db, nil)
	if err != nil {
		t.Fatalf("ListGDDModels after delete failed: %v", err)
	}
	if len(modelsAfter) != 0 {
		t.Errorf("expected 0 GDD models after delete, got %d", len(modelsAfter))
	}
}

func TestIrrigationCRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	_, lawn := createTestLawn(t, db)

	// Create
	entry := &model.IrrigationEntry{
		LawnID:   lawn.ID,
		Date:     time.Now().Truncate(24 * time.Hour),
		Amount:   0.5,
		Duration: 30,
		Source:   model.IrrigationManual,
	}
	created, err := CreateIrrigationEntry(db, entry)
	if err != nil {
		t.Fatalf("CreateIrrigationEntry failed: %v", err)
	}
	if created.ID == 0 {
		t.Fatal("expected non-zero irrigation entry ID")
	}
	if created.Amount != 0.5 {
		t.Errorf("expected amount 0.5, got %f", created.Amount)
	}

	// Create a second entry on a different date
	entry2 := &model.IrrigationEntry{
		LawnID:   lawn.ID,
		Date:     time.Now().AddDate(0, 0, -7).Truncate(24 * time.Hour),
		Amount:   1.0,
		Duration: 60,
		Source:   model.IrrigationAutomatic,
	}
	_, err = CreateIrrigationEntry(db, entry2)
	if err != nil {
		t.Fatalf("CreateIrrigationEntry (second) failed: %v", err)
	}

	// List (no date filter)
	entries, err := ListIrrigationEntries(db, lawn.ID, nil, nil)
	if err != nil {
		t.Fatalf("ListIrrigationEntries failed: %v", err)
	}
	if len(entries) != 2 {
		t.Errorf("expected 2 irrigation entries, got %d", len(entries))
	}

	// List (with date filter)
	start := time.Now().AddDate(0, 0, -1).Truncate(24 * time.Hour)
	filtered, err := ListIrrigationEntries(db, lawn.ID, &start, nil)
	if err != nil {
		t.Fatalf("ListIrrigationEntries (filtered) failed: %v", err)
	}
	if len(filtered) != 1 {
		t.Errorf("expected 1 irrigation entry in date range, got %d", len(filtered))
	}

	// Delete
	err = DeleteIrrigationEntry(db, created.ID)
	if err != nil {
		t.Fatalf("DeleteIrrigationEntry failed: %v", err)
	}
	entriesAfter, err := ListIrrigationEntries(db, lawn.ID, nil, nil)
	if err != nil {
		t.Fatalf("ListIrrigationEntries after delete failed: %v", err)
	}
	if len(entriesAfter) != 1 {
		t.Errorf("expected 1 irrigation entry after delete, got %d", len(entriesAfter))
	}
}

func TestTaskStatusCRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	// Create
	locID := loc.ID
	err := CreateTaskStatus(db, "task-abc-123", "fetch_weather", &locID)
	if err != nil {
		t.Fatalf("CreateTaskStatus failed: %v", err)
	}

	// Create without location
	err = CreateTaskStatus(db, "task-def-456", "compute_gdd", nil)
	if err != nil {
		t.Fatalf("CreateTaskStatus (no location) failed: %v", err)
	}

	// List
	statuses, err := ListTaskStatuses(db, 10)
	if err != nil {
		t.Fatalf("ListTaskStatuses failed: %v", err)
	}
	if len(statuses) != 2 {
		t.Errorf("expected 2 task statuses, got %d", len(statuses))
	}

	// Verify initial status is 'started'
	for _, s := range statuses {
		if s.Status != model.TaskStarted {
			t.Errorf("expected status 'started', got %q for task %q", s.Status, s.TaskName)
		}
	}

	// Update to success
	result := "completed successfully"
	err = UpdateTaskStatus(db, "task-abc-123", model.TaskSuccess, &result, nil)
	if err != nil {
		t.Fatalf("UpdateTaskStatus (success) failed: %v", err)
	}

	// Update to failure
	errMsg := "connection timeout"
	err = UpdateTaskStatus(db, "task-def-456", model.TaskFailure, nil, &errMsg)
	if err != nil {
		t.Fatalf("UpdateTaskStatus (failure) failed: %v", err)
	}

	// Verify updates
	statusesAfter, err := ListTaskStatuses(db, 10)
	if err != nil {
		t.Fatalf("ListTaskStatuses after update failed: %v", err)
	}
	for _, s := range statusesAfter {
		switch s.TaskID {
		case "task-abc-123":
			if s.Status != model.TaskSuccess {
				t.Errorf("expected status 'success' for task-abc-123, got %q", s.Status)
			}
			if !s.Result.Valid || s.Result.String != "completed successfully" {
				t.Errorf("expected result 'completed successfully', got %v", s.Result)
			}
		case "task-def-456":
			if s.Status != model.TaskFailure {
				t.Errorf("expected status 'failure' for task-def-456, got %q", s.Status)
			}
			if !s.Error.Valid || s.Error.String != "connection timeout" {
				t.Errorf("expected error 'connection timeout', got %v", s.Error)
			}
		}
	}

	// List with limit
	limited, err := ListTaskStatuses(db, 1)
	if err != nil {
		t.Fatalf("ListTaskStatuses (limited) failed: %v", err)
	}
	if len(limited) != 1 {
		t.Errorf("expected 1 task status with limit=1, got %d", len(limited))
	}
}

func TestWeatherUpsert(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	testDate := time.Date(2025, 6, 15, 0, 0, 0, 0, time.UTC)
	humMean := 65.0
	humMax := 80.0
	humMin := 50.0
	dpMax := 18.0
	dpMin := 12.0
	dpMean := 15.0
	sunDur := 36000.0

	// Insert initial weather record
	day1 := weather.DailyData{
		Date:                     testDate,
		TemperatureMaxC:          30.0,
		TemperatureMinC:          18.0,
		PrecipitationMM:          5.0,
		PrecipitationProbability: 40.0,
		WindSpeedMaxMs:           3.5,
		WindGustsMaxMs:           7.0,
		WindDirectionDeg:         180.0,
		ET0MM:                    4.5,
		RelativeHumidityMean:     &humMean,
		RelativeHumidityMax:      &humMax,
		RelativeHumidityMin:      &humMin,
		DewPointMaxC:             &dpMax,
		DewPointMinC:             &dpMin,
		DewPointMeanC:            &dpMean,
		SunshineDurationS:        &sunDur,
	}

	err := UpsertDailyWeather(db, loc.ID, day1, model.WeatherHistorical)
	if err != nil {
		t.Fatalf("UpsertDailyWeather (insert) failed: %v", err)
	}

	// Verify record exists
	rows, err := GetWeatherForLocation(db, loc.ID, nil, nil)
	if err != nil {
		t.Fatalf("GetWeatherForLocation failed: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 weather record, got %d", len(rows))
	}
	if rows[0].TemperatureMaxC != 30.0 {
		t.Errorf("expected temp max 30.0, got %f", rows[0].TemperatureMaxC)
	}

	// Upsert same day with updated max temp
	day2 := day1
	day2.TemperatureMaxC = 35.0

	err = UpsertDailyWeather(db, loc.ID, day2, model.WeatherHistorical)
	if err != nil {
		t.Fatalf("UpsertDailyWeather (update) failed: %v", err)
	}

	// Verify still only 1 record and temp was updated
	rows, err = GetWeatherForLocation(db, loc.ID, nil, nil)
	if err != nil {
		t.Fatalf("GetWeatherForLocation after upsert failed: %v", err)
	}
	if len(rows) != 1 {
		t.Errorf("expected 1 weather record after upsert, got %d", len(rows))
	}
	if rows[0].TemperatureMaxC != 35.0 {
		t.Errorf("expected updated temp max 35.0, got %f", rows[0].TemperatureMaxC)
	}
	if rows[0].LocationID != loc.ID {
		t.Errorf("expected location_id %d, got %d", loc.ID, rows[0].LocationID)
	}
	if rows[0].Type != model.WeatherHistorical {
		t.Errorf("expected type %q, got %q", model.WeatherHistorical, rows[0].Type)
	}

	// Verify date filtering works
	before := testDate.AddDate(0, 0, -1)
	after := testDate.AddDate(0, 0, 1)
	filtered, err := GetWeatherForLocation(db, loc.ID, &before, &after)
	if err != nil {
		t.Fatalf("GetWeatherForLocation (filtered) failed: %v", err)
	}
	if len(filtered) != 1 {
		t.Errorf("expected 1 record in date range, got %d", len(filtered))
	}

	// Verify filtering excludes records outside range
	farPast := testDate.AddDate(-1, 0, 0)
	farPastEnd := testDate.AddDate(0, 0, -1)
	empty, err := GetWeatherForLocation(db, loc.ID, &farPast, &farPastEnd)
	if err != nil {
		t.Fatalf("GetWeatherForLocation (empty range) failed: %v", err)
	}
	if len(empty) != 0 {
		t.Errorf("expected 0 records outside date range, got %d", len(empty))
	}
}

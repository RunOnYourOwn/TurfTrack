//go:build integration

package db

import (
	"database/sql"
	"fmt"
	"sync/atomic"
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
var testLocationCounter int64

func createTestLocation(t *testing.T, db *sql.DB) *model.Location {
	t.Helper()
	n := atomic.AddInt64(&testLocationCounter, 1)
	name := fmt.Sprintf("Test Location %d", n)
	lat := 35.0 + float64(n)*0.001
	lon := -85.0 + float64(n)*0.001
	loc, err := CreateLocation(db, name, lat, lon)
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
		true, loc.ID)
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
		true, loc.ID)
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
		false, loc.ID)
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
		false, loc.ID)
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
	apps, err := ListApplications(db, nil, "", "")
	if err != nil {
		t.Fatalf("ListApplications (all) failed: %v", err)
	}
	if len(apps) != 1 {
		t.Errorf("expected 1 application, got %d", len(apps))
	}

	// List (filtered by lawn)
	lawnID := lawn.ID
	appsFiltered, err := ListApplications(db, &lawnID, "", "")
	if err != nil {
		t.Fatalf("ListApplications (filtered) failed: %v", err)
	}
	if len(appsFiltered) != 1 {
		t.Errorf("expected 1 application for lawn, got %d", len(appsFiltered))
	}

	// List (filtered by non-existent lawn)
	noLawn := 99999
	appsEmpty, err := ListApplications(db, &noLawn, "", "")
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
	appsAfter, err := ListApplications(db, nil, "", "")
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

func TestSettingsCRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	// Get non-existent key
	_, err := GetSetting(db, "nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent setting")
	}

	// Set a value
	err = SetSetting(db, "weather_update_hour", "8")
	if err != nil {
		t.Fatalf("SetSetting failed: %v", err)
	}

	// Get it back
	val, err := GetSetting(db, "weather_update_hour")
	if err != nil {
		t.Fatalf("GetSetting failed: %v", err)
	}
	if val != "8" {
		t.Errorf("expected '8', got %q", val)
	}

	// Update (upsert)
	err = SetSetting(db, "weather_update_hour", "14")
	if err != nil {
		t.Fatalf("SetSetting (update) failed: %v", err)
	}
	val, err = GetSetting(db, "weather_update_hour")
	if err != nil {
		t.Fatalf("GetSetting after update failed: %v", err)
	}
	if val != "14" {
		t.Errorf("expected '14', got %q", val)
	}

	// Set multiple values and get all
	err = SetSetting(db, "weather_update_timezone", "America/New_York")
	if err != nil {
		t.Fatalf("SetSetting (timezone) failed: %v", err)
	}

	all, err := GetAllSettings(db)
	if err != nil {
		t.Fatalf("GetAllSettings failed: %v", err)
	}
	if len(all) != 2 {
		t.Errorf("expected 2 settings, got %d", len(all))
	}
	if all["weather_update_hour"] != "14" {
		t.Errorf("expected hour '14', got %q", all["weather_update_hour"])
	}
	if all["weather_update_timezone"] != "America/New_York" {
		t.Errorf("expected timezone 'America/New_York', got %q", all["weather_update_timezone"])
	}
}

func TestGDDResetsCRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	m := &model.GDDModel{
		LocationID:       loc.ID,
		Name:             "Crabgrass Preventer",
		BaseTemp:         50.0,
		Unit:             model.TempUnitF,
		StartDate:        time.Date(2025, 3, 1, 0, 0, 0, 0, time.UTC),
		Threshold:        200.0,
		ResetOnThreshold: true,
	}
	created, err := CreateGDDModel(db, m)
	if err != nil {
		t.Fatalf("CreateGDDModel failed: %v", err)
	}

	// Create manual reset
	r1, err := CreateGDDReset(db, created.ID, time.Date(2025, 5, 1, 0, 0, 0, 0, time.UTC), model.ResetManual)
	if err != nil {
		t.Fatalf("CreateGDDReset (manual) failed: %v", err)
	}
	if r1.RunNumber != 1 {
		t.Errorf("expected run_number 1, got %d", r1.RunNumber)
	}
	if r1.ResetType != model.ResetManual {
		t.Errorf("expected type 'manual', got %q", r1.ResetType)
	}

	// Create threshold reset
	r2, err := CreateGDDReset(db, created.ID, time.Date(2025, 6, 15, 0, 0, 0, 0, time.UTC), model.ResetThreshold)
	if err != nil {
		t.Fatalf("CreateGDDReset (threshold) failed: %v", err)
	}
	if r2.RunNumber != 2 {
		t.Errorf("expected run_number 2, got %d", r2.RunNumber)
	}

	// List resets
	resets, err := ListGDDResets(db, created.ID)
	if err != nil {
		t.Fatalf("ListGDDResets failed: %v", err)
	}
	if len(resets) != 2 {
		t.Errorf("expected 2 resets, got %d", len(resets))
	}

	// Delete by type (threshold only)
	err = DeleteGDDResetsByType(db, created.ID, model.ResetThreshold)
	if err != nil {
		t.Fatalf("DeleteGDDResetsByType failed: %v", err)
	}
	resetsAfter, err := ListGDDResets(db, created.ID)
	if err != nil {
		t.Fatalf("ListGDDResets after delete failed: %v", err)
	}
	if len(resetsAfter) != 1 {
		t.Errorf("expected 1 reset after deleting threshold, got %d", len(resetsAfter))
	}
	if resetsAfter[0].ResetType != model.ResetManual {
		t.Errorf("remaining reset should be manual, got %q", resetsAfter[0].ResetType)
	}

	// Delete individual reset
	err = DeleteGDDReset(db, r1.ID)
	if err != nil {
		t.Fatalf("DeleteGDDReset failed: %v", err)
	}
	resetsEmpty, err := ListGDDResets(db, created.ID)
	if err != nil {
		t.Fatalf("ListGDDResets final failed: %v", err)
	}
	if len(resetsEmpty) != 0 {
		t.Errorf("expected 0 resets, got %d", len(resetsEmpty))
	}
}

func TestGDDValuesUpsert(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	m := &model.GDDModel{
		LocationID: loc.ID,
		Name:       "Test GDD",
		BaseTemp:   10.0,
		Unit:       model.TempUnitC,
		StartDate:  time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	created, err := CreateGDDModel(db, m)
	if err != nil {
		t.Fatalf("CreateGDDModel failed: %v", err)
	}

	// Insert values
	values := []struct {
		Date          time.Time
		DailyGDD      float64
		CumulativeGDD float64
		IsForecast    bool
		Run           int
	}{
		{time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC), 5.0, 5.0, false, 1},
		{time.Date(2025, 1, 2, 0, 0, 0, 0, time.UTC), 7.0, 12.0, false, 1},
		{time.Date(2025, 1, 3, 0, 0, 0, 0, time.UTC), 6.0, 18.0, true, 1},
	}
	err = UpsertGDDValues(db, created.ID, values)
	if err != nil {
		t.Fatalf("UpsertGDDValues failed: %v", err)
	}

	// Read back
	got, err := GetGDDValues(db, created.ID)
	if err != nil {
		t.Fatalf("GetGDDValues failed: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("expected 3 GDD values, got %d", len(got))
	}
	if got[0].DailyGDD != 5.0 {
		t.Errorf("day 1 daily_gdd = %v, want 5.0", got[0].DailyGDD)
	}
	if got[1].CumulativeGDD != 12.0 {
		t.Errorf("day 2 cumulative_gdd = %v, want 12.0", got[1].CumulativeGDD)
	}
	if got[2].IsForecast != true {
		t.Error("day 3 should be forecast")
	}

	// Upsert replaces all values
	values2 := []struct {
		Date          time.Time
		DailyGDD      float64
		CumulativeGDD float64
		IsForecast    bool
		Run           int
	}{
		{time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC), 10.0, 10.0, false, 1},
	}
	err = UpsertGDDValues(db, created.ID, values2)
	if err != nil {
		t.Fatalf("UpsertGDDValues (replace) failed: %v", err)
	}
	got2, err := GetGDDValues(db, created.ID)
	if err != nil {
		t.Fatalf("GetGDDValues after replace failed: %v", err)
	}
	if len(got2) != 1 {
		t.Errorf("expected 1 GDD value after replace, got %d", len(got2))
	}

	// Empty upsert is a no-op
	err = UpsertGDDValues(db, created.ID, nil)
	if err != nil {
		t.Fatalf("UpsertGDDValues (empty) failed: %v", err)
	}
}

func TestGDDModelGetAndUpdate(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	m := &model.GDDModel{
		LocationID:       loc.ID,
		Name:             "Original Name",
		BaseTemp:         50.0,
		Unit:             model.TempUnitF,
		StartDate:        time.Date(2025, 3, 1, 0, 0, 0, 0, time.UTC),
		Threshold:        200.0,
		ResetOnThreshold: false,
	}
	created, err := CreateGDDModel(db, m)
	if err != nil {
		t.Fatalf("CreateGDDModel failed: %v", err)
	}

	// Get
	got, err := GetGDDModel(db, created.ID)
	if err != nil {
		t.Fatalf("GetGDDModel failed: %v", err)
	}
	if got.Name != "Original Name" {
		t.Errorf("expected name 'Original Name', got %q", got.Name)
	}
	if got.BaseTemp != 50.0 {
		t.Errorf("expected base_temp 50, got %v", got.BaseTemp)
	}
	if got.Unit != model.TempUnitF {
		t.Errorf("expected unit F, got %q", got.Unit)
	}

	// Get non-existent
	missing, err := GetGDDModel(db, 99999)
	if err != nil {
		t.Fatalf("GetGDDModel for missing ID returned error: %v", err)
	}
	if missing != nil {
		t.Error("expected nil for non-existent GDD model")
	}

	// Update
	got.Name = "Updated Name"
	got.BaseTemp = 10.0
	got.Unit = model.TempUnitC
	got.ResetOnThreshold = true
	updated, err := UpdateGDDModel(db, got)
	if err != nil {
		t.Fatalf("UpdateGDDModel failed: %v", err)
	}
	if updated.Name != "Updated Name" {
		t.Errorf("expected updated name, got %q", updated.Name)
	}
	if updated.BaseTemp != 10.0 {
		t.Errorf("expected base_temp 10, got %v", updated.BaseTemp)
	}
	if updated.Unit != model.TempUnitC {
		t.Errorf("expected unit C, got %q", updated.Unit)
	}
	if !updated.ResetOnThreshold {
		t.Error("expected reset_on_threshold true")
	}
}

// createTestApplication is a helper that creates an application with a lawn and product.
func createTestApplication(t *testing.T, db *sql.DB) (*model.Lawn, *model.Product, *model.Application) {
	t.Helper()
	_, lawn := createTestLawn(t, db)
	product := createTestProduct(t, db)
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
	return lawn, product, created
}

func TestUpdateProduct(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	// Create a product
	weight := 50.0
	cost := 45.99
	p := &model.Product{
		Name:       "Original Fertilizer",
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

	// Update fields
	created.Name = "Updated Fertilizer"
	created.NPct = 24.0
	created.PPct = 0.0
	created.KPct = 4.0
	newWeight := 40.0
	newCost := 35.50
	created.WeightLbs = &newWeight
	created.CostPerBag = &newCost
	created.FePct = 2.5

	updated, err := UpdateProduct(db, created)
	if err != nil {
		t.Fatalf("UpdateProduct failed: %v", err)
	}
	if updated.Name != "Updated Fertilizer" {
		t.Errorf("expected updated name, got %q", updated.Name)
	}
	if updated.NPct != 24.0 {
		t.Errorf("expected N pct 24.0, got %f", updated.NPct)
	}
	if updated.KPct != 4.0 {
		t.Errorf("expected K pct 4.0, got %f", updated.KPct)
	}
	if updated.FePct != 2.5 {
		t.Errorf("expected Fe pct 2.5, got %f", updated.FePct)
	}

	// Verify via Get
	got, err := GetProduct(db, updated.ID)
	if err != nil {
		t.Fatalf("GetProduct after update failed: %v", err)
	}
	if got.Name != "Updated Fertilizer" {
		t.Errorf("GetProduct name mismatch after update: %q", got.Name)
	}
	if got.NPct != 24.0 {
		t.Errorf("GetProduct N pct mismatch: %f", got.NPct)
	}
	if got.WeightLbs == nil || *got.WeightLbs != 40.0 {
		t.Errorf("expected weight 40.0, got %v", got.WeightLbs)
	}
}

func TestGetApplication(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	lawn, product, created := createTestApplication(t, db)

	// Get the application by ID
	got, err := GetApplication(db, created.ID)
	if err != nil {
		t.Fatalf("GetApplication failed: %v", err)
	}
	if got == nil {
		t.Fatal("GetApplication returned nil")
	}
	if got.ID != created.ID {
		t.Errorf("expected ID %d, got %d", created.ID, got.ID)
	}
	if got.LawnID != lawn.ID {
		t.Errorf("expected lawn_id %d, got %d", lawn.ID, got.LawnID)
	}
	if got.ProductID != product.ID {
		t.Errorf("expected product_id %d, got %d", product.ID, got.ProductID)
	}
	if got.AmountPerArea != 4.0 {
		t.Errorf("expected amount_per_area 4.0, got %f", got.AmountPerArea)
	}
	if got.AreaUnit != 1000 {
		t.Errorf("expected area_unit 1000, got %d", got.AreaUnit)
	}
	if got.Unit != model.UnitLbs {
		t.Errorf("expected unit %q, got %q", model.UnitLbs, got.Unit)
	}
	if got.Status != model.AppCompleted {
		t.Errorf("expected status %q, got %q", model.AppCompleted, got.Status)
	}

	// Get non-existent
	missing, err := GetApplication(db, 99999)
	if err != nil {
		t.Fatalf("GetApplication for missing ID returned error: %v", err)
	}
	if missing != nil {
		t.Error("expected nil for non-existent application")
	}
}

func TestUpdateApplication(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	_, _, created := createTestApplication(t, db)

	// Update fields
	created.AmountPerArea = 8.0
	created.AreaUnit = 500
	created.Unit = model.UnitOz
	created.Status = model.AppPlanned
	nApplied := 1.5
	created.NApplied = &nApplied

	updated, err := UpdateApplication(db, created)
	if err != nil {
		t.Fatalf("UpdateApplication failed: %v", err)
	}
	if updated.AmountPerArea != 8.0 {
		t.Errorf("expected amount_per_area 8.0, got %f", updated.AmountPerArea)
	}
	if updated.AreaUnit != 500 {
		t.Errorf("expected area_unit 500, got %d", updated.AreaUnit)
	}
	if updated.Unit != model.UnitOz {
		t.Errorf("expected unit %q, got %q", model.UnitOz, updated.Unit)
	}
	if updated.Status != model.AppPlanned {
		t.Errorf("expected status %q, got %q", model.AppPlanned, updated.Status)
	}

	// Verify via Get
	got, err := GetApplication(db, updated.ID)
	if err != nil {
		t.Fatalf("GetApplication after update failed: %v", err)
	}
	if got.AmountPerArea != 8.0 {
		t.Errorf("GetApplication amount mismatch: %f", got.AmountPerArea)
	}
	if got.NApplied == nil || *got.NApplied != 1.5 {
		t.Errorf("expected n_applied 1.5, got %v", got.NApplied)
	}
}

func TestDeleteOrphanedLocation(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	// Create a location with a lawn (should NOT be deleted)
	loc1 := createTestLocation(t, db)
	_, err := CreateLawn(db, "Lawn On Loc1", 3000, model.GrassTypeCold, "", true, loc1.ID)
	if err != nil {
		t.Fatalf("CreateLawn failed: %v", err)
	}

	// Create an orphaned location (no lawns, should be deleted)
	loc2 := createTestLocation(t, db)

	// Try to delete both
	DeleteOrphanedLocation(db, loc1.ID)
	DeleteOrphanedLocation(db, loc2.ID)

	// loc1 should still exist
	got1, err := GetLocation(db, loc1.ID)
	if err != nil {
		t.Fatalf("GetLocation (loc1) failed: %v", err)
	}
	if got1 == nil {
		t.Error("expected loc1 to still exist (has lawn), but it was deleted")
	}

	// loc2 should be gone
	got2, err := GetLocation(db, loc2.ID)
	if err != nil {
		t.Fatalf("GetLocation (loc2) failed: %v", err)
	}
	if got2 != nil {
		t.Error("expected loc2 to be deleted (no lawns), but it still exists")
	}
}

func TestGetDiseasePressure(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	date1 := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)
	date2 := time.Date(2025, 6, 10, 0, 0, 0, 0, time.UTC)
	date3 := time.Date(2025, 7, 1, 0, 0, 0, 0, time.UTC)

	// Insert disease pressure records via raw SQL
	_, err := db.Exec(`INSERT INTO disease_pressure (date, location_id, disease, risk_score) VALUES ($1, $2, $3, $4)`,
		date1, loc.ID, "dollar_spot", 0.75)
	if err != nil {
		t.Fatalf("insert disease_pressure 1 failed: %v", err)
	}
	_, err = db.Exec(`INSERT INTO disease_pressure (date, location_id, disease, risk_score) VALUES ($1, $2, $3, $4)`,
		date2, loc.ID, "brown_patch", 0.50)
	if err != nil {
		t.Fatalf("insert disease_pressure 2 failed: %v", err)
	}
	_, err = db.Exec(`INSERT INTO disease_pressure (date, location_id, disease, risk_score) VALUES ($1, $2, $3, $4)`,
		date3, loc.ID, "dollar_spot", 0.90)
	if err != nil {
		t.Fatalf("insert disease_pressure 3 failed: %v", err)
	}

	// Get all
	results, err := GetDiseasePressure(db, loc.ID, nil, nil)
	if err != nil {
		t.Fatalf("GetDiseasePressure (all) failed: %v", err)
	}
	if len(results) != 3 {
		t.Fatalf("expected 3 disease pressure records, got %d", len(results))
	}
	if results[0].Disease != "dollar_spot" {
		t.Errorf("expected first disease 'dollar_spot', got %q", results[0].Disease)
	}
	if results[0].RiskScore == nil || *results[0].RiskScore != 0.75 {
		t.Errorf("expected risk_score 0.75, got %v", results[0].RiskScore)
	}
	if results[0].LocationID != loc.ID {
		t.Errorf("expected location_id %d, got %d", loc.ID, results[0].LocationID)
	}

	// Get with date range filter
	start := time.Date(2025, 6, 5, 0, 0, 0, 0, time.UTC)
	end := time.Date(2025, 6, 15, 0, 0, 0, 0, time.UTC)
	filtered, err := GetDiseasePressure(db, loc.ID, &start, &end)
	if err != nil {
		t.Fatalf("GetDiseasePressure (filtered) failed: %v", err)
	}
	if len(filtered) != 1 {
		t.Errorf("expected 1 disease pressure record in date range, got %d", len(filtered))
	}
	if len(filtered) > 0 && filtered[0].Disease != "brown_patch" {
		t.Errorf("expected 'brown_patch' in filtered results, got %q", filtered[0].Disease)
	}

	// Get for non-existent location
	empty, err := GetDiseasePressure(db, 99999, nil, nil)
	if err != nil {
		t.Fatalf("GetDiseasePressure (empty) failed: %v", err)
	}
	if len(empty) != 0 {
		t.Errorf("expected 0 records for non-existent location, got %d", len(empty))
	}
}

func TestGetGrowthPotential(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	date1 := time.Date(2025, 5, 1, 0, 0, 0, 0, time.UTC)
	date2 := time.Date(2025, 5, 15, 0, 0, 0, 0, time.UTC)
	date3 := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)

	// Insert growth potential records via raw SQL
	_, err := db.Exec(`INSERT INTO growth_potential (date, location_id, growth_potential, gp_3d_avg, gp_5d_avg, gp_7d_avg) VALUES ($1, $2, $3, $4, $5, $6)`,
		date1, loc.ID, 0.65, 0.60, 0.58, 0.55)
	if err != nil {
		t.Fatalf("insert growth_potential 1 failed: %v", err)
	}
	_, err = db.Exec(`INSERT INTO growth_potential (date, location_id, growth_potential, gp_3d_avg, gp_5d_avg, gp_7d_avg) VALUES ($1, $2, $3, $4, $5, $6)`,
		date2, loc.ID, 0.80, 0.75, 0.72, 0.70)
	if err != nil {
		t.Fatalf("insert growth_potential 2 failed: %v", err)
	}
	_, err = db.Exec(`INSERT INTO growth_potential (date, location_id, growth_potential, gp_3d_avg, gp_5d_avg, gp_7d_avg) VALUES ($1, $2, $3, $4, $5, $6)`,
		date3, loc.ID, 0.90, 0.85, 0.82, 0.80)
	if err != nil {
		t.Fatalf("insert growth_potential 3 failed: %v", err)
	}

	// Get all
	results, err := GetGrowthPotential(db, loc.ID, nil, nil)
	if err != nil {
		t.Fatalf("GetGrowthPotential (all) failed: %v", err)
	}
	if len(results) != 3 {
		t.Fatalf("expected 3 growth potential records, got %d", len(results))
	}
	if results[0].GrowthPotential == nil || *results[0].GrowthPotential != 0.65 {
		t.Errorf("expected growth_potential 0.65, got %v", results[0].GrowthPotential)
	}
	if results[0].GP3dAvg == nil || *results[0].GP3dAvg != 0.60 {
		t.Errorf("expected gp_3d_avg 0.60, got %v", results[0].GP3dAvg)
	}
	if results[0].GP7dAvg == nil || *results[0].GP7dAvg != 0.55 {
		t.Errorf("expected gp_7d_avg 0.55, got %v", results[0].GP7dAvg)
	}
	if results[0].LocationID != loc.ID {
		t.Errorf("expected location_id %d, got %d", loc.ID, results[0].LocationID)
	}

	// Get with date range filter
	start := time.Date(2025, 5, 10, 0, 0, 0, 0, time.UTC)
	end := time.Date(2025, 5, 20, 0, 0, 0, 0, time.UTC)
	filtered, err := GetGrowthPotential(db, loc.ID, &start, &end)
	if err != nil {
		t.Fatalf("GetGrowthPotential (filtered) failed: %v", err)
	}
	if len(filtered) != 1 {
		t.Errorf("expected 1 growth potential record in date range, got %d", len(filtered))
	}

	// Get for non-existent location
	empty, err := GetGrowthPotential(db, 99999, nil, nil)
	if err != nil {
		t.Fatalf("GetGrowthPotential (empty) failed: %v", err)
	}
	if len(empty) != 0 {
		t.Errorf("expected 0 records for non-existent location, got %d", len(empty))
	}
}

func TestGetWeeklyWaterSummaries(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	_, lawn := createTestLawn(t, db)

	weekStart1 := time.Date(2025, 6, 2, 0, 0, 0, 0, time.UTC)
	weekEnd1 := time.Date(2025, 6, 8, 0, 0, 0, 0, time.UTC)
	weekStart2 := time.Date(2025, 6, 9, 0, 0, 0, 0, time.UTC)
	weekEnd2 := time.Date(2025, 6, 15, 0, 0, 0, 0, time.UTC)

	// Insert weekly water summaries via raw SQL
	_, err := db.Exec(`INSERT INTO weekly_water_summaries
		(lawn_id, week_start, week_end, et0_total, precipitation_total, irrigation_applied, water_deficit, status, is_forecast)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		lawn.ID, weekStart1, weekEnd1, 1.5, 0.5, 0.75, 0.25, "deficit", false)
	if err != nil {
		t.Fatalf("insert weekly_water_summaries 1 failed: %v", err)
	}
	_, err = db.Exec(`INSERT INTO weekly_water_summaries
		(lawn_id, week_start, week_end, et0_total, precipitation_total, irrigation_applied, water_deficit, status, is_forecast)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		lawn.ID, weekStart2, weekEnd2, 1.2, 1.0, 0.0, -0.2, "surplus", true)
	if err != nil {
		t.Fatalf("insert weekly_water_summaries 2 failed: %v", err)
	}

	// Retrieve
	results, err := GetWeeklyWaterSummaries(db, lawn.ID)
	if err != nil {
		t.Fatalf("GetWeeklyWaterSummaries failed: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected 2 water summaries, got %d", len(results))
	}

	// Results are ordered by week_start DESC, so the second inserted comes first
	if results[0].LawnID != lawn.ID {
		t.Errorf("expected lawn_id %d, got %d", lawn.ID, results[0].LawnID)
	}
	if results[0].ET0Total != 1.2 {
		t.Errorf("expected et0_total 1.2, got %f", results[0].ET0Total)
	}
	if results[0].Status != "surplus" {
		t.Errorf("expected status 'surplus', got %q", results[0].Status)
	}
	if !results[0].IsForecast {
		t.Error("expected is_forecast true for second week")
	}
	if results[1].PrecipitationTotal != 0.5 {
		t.Errorf("expected precipitation_total 0.5, got %f", results[1].PrecipitationTotal)
	}
	if results[1].IrrigationApplied != 0.75 {
		t.Errorf("expected irrigation_applied 0.75, got %f", results[1].IrrigationApplied)
	}
	if results[1].WaterDeficit != 0.25 {
		t.Errorf("expected water_deficit 0.25, got %f", results[1].WaterDeficit)
	}

	// Empty for non-existent lawn
	empty, err := GetWeeklyWaterSummaries(db, 99999)
	if err != nil {
		t.Fatalf("GetWeeklyWaterSummaries (empty) failed: %v", err)
	}
	if len(empty) != 0 {
		t.Errorf("expected 0 summaries for non-existent lawn, got %d", len(empty))
	}
}

func TestListWeedSpecies(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	// The migration 004 seeds 5 active weed species.
	// Insert one more that is inactive.
	_, err := db.Exec(`INSERT INTO weed_species
		(name, common_name, gdd_base_temp_c, gdd_threshold_emergence,
		 optimal_soil_temp_min_c, optimal_soil_temp_max_c, moisture_preference, season, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		"test_inactive_weed", "Inactive Weed", 10.0, 100.0, 12.0, 28.0, "low", "spring", false)
	if err != nil {
		t.Fatalf("insert inactive weed species failed: %v", err)
	}

	// List all (including inactive)
	all, err := ListWeedSpecies(db, false)
	if err != nil {
		t.Fatalf("ListWeedSpecies (all) failed: %v", err)
	}
	if len(all) != 6 {
		t.Errorf("expected 6 weed species (5 seeded + 1 inactive), got %d", len(all))
	}

	// List active only
	active, err := ListWeedSpecies(db, true)
	if err != nil {
		t.Fatalf("ListWeedSpecies (activeOnly) failed: %v", err)
	}
	if len(active) != 5 {
		t.Errorf("expected 5 active weed species, got %d", len(active))
	}
	for _, ws := range active {
		if !ws.IsActive {
			t.Errorf("expected all active species, but got inactive: %q", ws.Name)
		}
	}

	// Verify species fields on one of the seeded ones
	var found bool
	for _, ws := range active {
		if ws.Name == "crabgrass" {
			found = true
			if ws.CommonName != "Crabgrass" {
				t.Errorf("expected common_name 'Crabgrass', got %q", ws.CommonName)
			}
			if ws.GDDBaseTempC != 10.0 {
				t.Errorf("expected gdd_base_temp_c 10.0, got %f", ws.GDDBaseTempC)
			}
			if ws.Season != model.SeasonSummer {
				t.Errorf("expected season 'summer', got %q", ws.Season)
			}
			break
		}
	}
	if !found {
		t.Error("expected to find seeded 'crabgrass' species")
	}
}

func TestGetWeedPressure(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	// Get species IDs from the seeded data
	var crabgrassID, goosegrassID int
	err := db.QueryRow("SELECT id FROM weed_species WHERE name = 'crabgrass'").Scan(&crabgrassID)
	if err != nil {
		t.Fatalf("could not find crabgrass species: %v", err)
	}
	err = db.QueryRow("SELECT id FROM weed_species WHERE name = 'goosegrass'").Scan(&goosegrassID)
	if err != nil {
		t.Fatalf("could not find goosegrass species: %v", err)
	}

	date1 := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)
	date2 := time.Date(2025, 6, 15, 0, 0, 0, 0, time.UTC)

	// Insert weed pressure records via raw SQL
	_, err = db.Exec(`INSERT INTO weed_pressure
		(location_id, date, weed_species_id, weed_pressure_score, gdd_risk_score,
		 soil_temp_risk_score, moisture_risk_score, turf_stress_score, seasonal_timing_score,
		 gdd_accumulated, soil_temp_estimate_c, precipitation_3day_mm, humidity_avg, et0_mm, is_forecast)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
		loc.ID, date1, crabgrassID, 0.85, 0.80, 0.70, 0.60, 0.50, 0.90,
		250.0, 22.0, 15.0, 65.0, 4.5, false)
	if err != nil {
		t.Fatalf("insert weed_pressure 1 failed: %v", err)
	}

	_, err = db.Exec(`INSERT INTO weed_pressure
		(location_id, date, weed_species_id, weed_pressure_score, gdd_risk_score,
		 soil_temp_risk_score, moisture_risk_score, turf_stress_score, seasonal_timing_score,
		 gdd_accumulated, soil_temp_estimate_c, precipitation_3day_mm, humidity_avg, et0_mm, is_forecast)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
		loc.ID, date2, goosegrassID, 0.40, 0.35, 0.30, 0.25, 0.20, 0.45,
		180.0, 20.0, 5.0, 55.0, 3.0, true)
	if err != nil {
		t.Fatalf("insert weed_pressure 2 failed: %v", err)
	}

	// Get all
	results, err := GetWeedPressure(db, loc.ID, nil, nil)
	if err != nil {
		t.Fatalf("GetWeedPressure (all) failed: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected 2 weed pressure records, got %d", len(results))
	}

	// Verify first record (crabgrass on date1)
	if results[0].WeedPressureScore != 0.85 {
		t.Errorf("expected weed_pressure_score 0.85, got %f", results[0].WeedPressureScore)
	}
	if results[0].GDDRiskScore != 0.80 {
		t.Errorf("expected gdd_risk_score 0.80, got %f", results[0].GDDRiskScore)
	}
	if results[0].GDDAccumulated != 250.0 {
		t.Errorf("expected gdd_accumulated 250.0, got %f", results[0].GDDAccumulated)
	}
	if results[0].LocationID != loc.ID {
		t.Errorf("expected location_id %d, got %d", loc.ID, results[0].LocationID)
	}
	if results[0].WeedSpeciesID != crabgrassID {
		t.Errorf("expected weed_species_id %d, got %d", crabgrassID, results[0].WeedSpeciesID)
	}

	// Verify JOIN populated WeedSpeciesObj
	if results[0].WeedSpeciesObj == nil {
		t.Fatal("expected WeedSpeciesObj to be populated via JOIN")
	}
	if results[0].WeedSpeciesObj.Name != "crabgrass" {
		t.Errorf("expected species name 'crabgrass', got %q", results[0].WeedSpeciesObj.Name)
	}
	if results[0].WeedSpeciesObj.CommonName != "Crabgrass" {
		t.Errorf("expected common_name 'Crabgrass', got %q", results[0].WeedSpeciesObj.CommonName)
	}

	// Verify second record
	if results[1].WeedSpeciesObj == nil {
		t.Fatal("expected WeedSpeciesObj on second record")
	}
	if results[1].WeedSpeciesObj.Name != "goosegrass" {
		t.Errorf("expected species name 'goosegrass', got %q", results[1].WeedSpeciesObj.Name)
	}
	if !results[1].IsForecast {
		t.Error("expected is_forecast true on second record")
	}

	// Get with date filter
	start := time.Date(2025, 6, 10, 0, 0, 0, 0, time.UTC)
	filtered, err := GetWeedPressure(db, loc.ID, &start, nil)
	if err != nil {
		t.Fatalf("GetWeedPressure (filtered) failed: %v", err)
	}
	if len(filtered) != 1 {
		t.Errorf("expected 1 weed pressure record in date range, got %d", len(filtered))
	}

	// Get for non-existent location
	empty, err := GetWeedPressure(db, 99999, nil, nil)
	if err != nil {
		t.Fatalf("GetWeedPressure (empty) failed: %v", err)
	}
	if len(empty) != 0 {
		t.Errorf("expected 0 records for non-existent location, got %d", len(empty))
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

//go:build integration

package scheduler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	_ "github.com/lib/pq"

	dbpkg "github.com/RunOnYourOwn/TurfTrack/go-app/internal/db"
	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/model"
	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/weather"
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
	db.Exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;") //nolint:errcheck
	if err := dbpkg.RunMigrations(db, "../../migrations"); err != nil {
		t.Fatalf("RunMigrations failed: %v", err)
	}
	return db
}

func createTestLocation(t *testing.T, db *sql.DB) *model.Location {
	t.Helper()
	loc, err := dbpkg.CreateLocation(db, "Test Location", 35.0, -85.0)
	if err != nil {
		t.Fatalf("CreateLocation failed: %v", err)
	}
	return loc
}

func createTestLawn(t *testing.T, db *sql.DB, locID int, grassType model.GrassType) *model.Lawn {
	t.Helper()
	lawn, err := dbpkg.CreateLawn(db, "Test Lawn", 5000, grassType, "", true, locID)
	if err != nil {
		t.Fatalf("CreateLawn failed: %v", err)
	}
	return lawn
}

// insertTestWeather inserts weather data for a range of days.
func insertTestWeather(t *testing.T, db *sql.DB, locID int, startDate time.Time, days int, tempMaxC, tempMinC float64) []model.DailyWeather {
	t.Helper()
	var result []model.DailyWeather
	humMean := 70.0
	for i := 0; i < days; i++ {
		date := startDate.AddDate(0, 0, i)
		day := weather.DailyData{
			Date:                 date,
			TemperatureMaxC:      tempMaxC,
			TemperatureMinC:      tempMinC,
			PrecipitationMM:      2.0,
			WindSpeedMaxMs:       3.0,
			WindGustsMaxMs:       6.0,
			WindDirectionDeg:     180.0,
			ET0MM:                4.0,
			RelativeHumidityMean: &humMean,
		}

		wType := model.WeatherHistorical
		if date.After(time.Now().UTC().Truncate(24 * time.Hour)) {
			wType = model.WeatherForecast
		}
		if err := dbpkg.UpsertDailyWeather(db, locID, day, wType); err != nil {
			t.Fatalf("UpsertDailyWeather failed: %v", err)
		}

		result = append(result, model.DailyWeather{
			Date:                 date,
			LocationID:           locID,
			Type:                 wType,
			TemperatureMaxC:      tempMaxC,
			TemperatureMinC:      tempMinC,
			TemperatureMaxF:      weather.CtoF(tempMaxC),
			TemperatureMinF:      weather.CtoF(tempMinC),
			PrecipitationMM:      2.0,
			ET0MM:                4.0,
			RelativeHumidityMean: &humMean,
		})
	}
	return result
}

// --- RecalculateGDDForModel tests ---

func TestRecalculateGDDForModelCelsius(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	// Insert 10 days of weather: max=30°C, min=20°C → avg=25°C
	startDate := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)
	weatherData := insertTestWeather(t, db, loc.ID, startDate, 10, 30.0, 20.0)

	// Create GDD model in Celsius, base=10°C
	m := &model.GDDModel{
		LocationID: loc.ID,
		Name:       "Celsius Model",
		BaseTemp:   10.0,
		Unit:       model.TempUnitC,
		StartDate:  startDate,
	}
	created, err := dbpkg.CreateGDDModel(db, m)
	if err != nil {
		t.Fatalf("CreateGDDModel failed: %v", err)
	}

	// Run recalculation
	err = RecalculateGDDForModel(db, created, weatherData)
	if err != nil {
		t.Fatalf("RecalculateGDDForModel failed: %v", err)
	}

	// Verify values
	values, err := dbpkg.GetGDDValues(db, created.ID)
	if err != nil {
		t.Fatalf("GetGDDValues failed: %v", err)
	}
	if len(values) != 10 {
		t.Fatalf("expected 10 GDD values, got %d", len(values))
	}

	// Daily GDD = (30+20)/2 - 10 = 15
	if math.Abs(values[0].DailyGDD-15.0) > 0.001 {
		t.Errorf("day 1 daily_gdd = %v, want 15.0", values[0].DailyGDD)
	}
	// Cumulative after 10 days = 150
	if math.Abs(values[9].CumulativeGDD-150.0) > 0.001 {
		t.Errorf("day 10 cumulative = %v, want 150.0", values[9].CumulativeGDD)
	}
	// All run 1
	for i, v := range values {
		if v.Run != 1 {
			t.Errorf("day %d run = %d, want 1", i+1, v.Run)
		}
	}
}

func TestRecalculateGDDForModelFahrenheit(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	// Insert 10 days of weather: max=30°C (86°F), min=20°C (68°F)
	startDate := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)
	weatherData := insertTestWeather(t, db, loc.ID, startDate, 10, 30.0, 20.0)

	// Create GDD model in Fahrenheit, base=50°F
	m := &model.GDDModel{
		LocationID: loc.ID,
		Name:       "Fahrenheit Model",
		BaseTemp:   50.0,
		Unit:       model.TempUnitF,
		StartDate:  startDate,
	}
	created, err := dbpkg.CreateGDDModel(db, m)
	if err != nil {
		t.Fatalf("CreateGDDModel failed: %v", err)
	}

	err = RecalculateGDDForModel(db, created, weatherData)
	if err != nil {
		t.Fatalf("RecalculateGDDForModel failed: %v", err)
	}

	values, err := dbpkg.GetGDDValues(db, created.ID)
	if err != nil {
		t.Fatalf("GetGDDValues failed: %v", err)
	}
	if len(values) != 10 {
		t.Fatalf("expected 10 GDD values, got %d", len(values))
	}

	// Weather stored as C, converted to F: max=86°F, min=68°F
	// Daily GDD = (86+68)/2 - 50 = 27
	if math.Abs(values[0].DailyGDD-27.0) > 0.001 {
		t.Errorf("day 1 daily_gdd (F) = %v, want 27.0", values[0].DailyGDD)
	}
	// Cumulative after 10 days = 270
	if math.Abs(values[9].CumulativeGDD-270.0) > 0.001 {
		t.Errorf("day 10 cumulative (F) = %v, want 270.0", values[9].CumulativeGDD)
	}
}

func TestRecalculateGDDFahrenheitCelsiusEquivalence(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	startDate := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)
	weatherData := insertTestWeather(t, db, loc.ID, startDate, 5, 30.0, 20.0)

	// Create Celsius model: base=10°C
	mC := &model.GDDModel{
		LocationID: loc.ID,
		Name:       "C Model",
		BaseTemp:   10.0,
		Unit:       model.TempUnitC,
		StartDate:  startDate,
	}
	createdC, _ := dbpkg.CreateGDDModel(db, mC)
	_ = RecalculateGDDForModel(db, createdC, weatherData)

	// Create Fahrenheit model: base=50°F (equivalent to 10°C)
	mF := &model.GDDModel{
		LocationID: loc.ID,
		Name:       "F Model",
		BaseTemp:   50.0,
		Unit:       model.TempUnitF,
		StartDate:  startDate,
	}
	createdF, _ := dbpkg.CreateGDDModel(db, mF)
	_ = RecalculateGDDForModel(db, createdF, weatherData)

	valuesC, _ := dbpkg.GetGDDValues(db, createdC.ID)
	valuesF, _ := dbpkg.GetGDDValues(db, createdF.ID)

	if len(valuesC) != len(valuesF) {
		t.Fatalf("C and F models produced different number of values: %d vs %d", len(valuesC), len(valuesF))
	}

	// F GDD should be exactly 9/5 (1.8x) of C GDD for equivalent base temps
	for i := range valuesC {
		ratio := valuesF[i].CumulativeGDD / valuesC[i].CumulativeGDD
		if math.Abs(ratio-1.8) > 0.001 {
			t.Errorf("day %d: F/C ratio = %v, want 1.8", i+1, ratio)
		}
	}
}

func TestRecalculateGDDWithThresholdResetFahrenheit(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	// 10 days, 27 GDD-F/day → reaches 200 on day 8 (27*8=216)
	startDate := time.Date(2025, 4, 1, 0, 0, 0, 0, time.UTC)
	weatherData := insertTestWeather(t, db, loc.ID, startDate, 10, 30.0, 20.0)

	m := &model.GDDModel{
		LocationID:       loc.ID,
		Name:             "Crabgrass Preventer F",
		BaseTemp:         50.0,
		Unit:             model.TempUnitF,
		StartDate:        startDate,
		Threshold:        200.0,
		ResetOnThreshold: true,
	}
	created, _ := dbpkg.CreateGDDModel(db, m)

	err := RecalculateGDDForModel(db, created, weatherData)
	if err != nil {
		t.Fatalf("RecalculateGDDForModel failed: %v", err)
	}

	values, _ := dbpkg.GetGDDValues(db, created.ID)

	// Day 8: cum=216 >= 200 threshold, reset next day
	if values[7].Run != 1 {
		t.Errorf("day 8 run = %d, want 1", values[7].Run)
	}
	if math.Abs(values[7].CumulativeGDD-216) > 0.001 {
		t.Errorf("day 8 cumulative = %v, want 216", values[7].CumulativeGDD)
	}

	// Day 9: new run
	if values[8].Run != 2 {
		t.Errorf("day 9 run = %d, want 2", values[8].Run)
	}
	if math.Abs(values[8].CumulativeGDD-27) > 0.001 {
		t.Errorf("day 9 cumulative = %v, want 27 (reset)", values[8].CumulativeGDD)
	}

	// Verify threshold resets were recorded
	resets, err := dbpkg.ListGDDResets(db, created.ID)
	if err != nil {
		t.Fatalf("ListGDDResets failed: %v", err)
	}
	thresholdResets := 0
	for _, r := range resets {
		if r.ResetType == model.ResetThreshold {
			thresholdResets++
		}
	}
	if thresholdResets != 1 {
		t.Errorf("expected 1 threshold reset, got %d", thresholdResets)
	}
}

func TestRecalculateGDDWithManualReset(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	startDate := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)
	weatherData := insertTestWeather(t, db, loc.ID, startDate, 10, 30.0, 20.0)

	m := &model.GDDModel{
		LocationID: loc.ID,
		Name:       "Manual Reset Test",
		BaseTemp:   10.0,
		Unit:       model.TempUnitC,
		StartDate:  startDate,
	}
	created, _ := dbpkg.CreateGDDModel(db, m)

	// Add manual reset on day 5
	resetDate := startDate.AddDate(0, 0, 4) // June 5
	_, err := dbpkg.CreateGDDReset(db, created.ID, resetDate, model.ResetManual)
	if err != nil {
		t.Fatalf("CreateGDDReset failed: %v", err)
	}

	err = RecalculateGDDForModel(db, created, weatherData)
	if err != nil {
		t.Fatalf("RecalculateGDDForModel failed: %v", err)
	}

	values, _ := dbpkg.GetGDDValues(db, created.ID)

	// Days 1-4: run 1, cumulative = 15*4 = 60
	if values[3].Run != 1 {
		t.Errorf("day 4 run = %d, want 1", values[3].Run)
	}
	if math.Abs(values[3].CumulativeGDD-60) > 0.001 {
		t.Errorf("day 4 cumulative = %v, want 60", values[3].CumulativeGDD)
	}

	// Day 5: manual reset → run 2, cumulative = 15
	if values[4].Run != 2 {
		t.Errorf("day 5 run = %d, want 2", values[4].Run)
	}
	if math.Abs(values[4].CumulativeGDD-15) > 0.001 {
		t.Errorf("day 5 cumulative = %v, want 15", values[4].CumulativeGDD)
	}

	// Day 10: run 2, cumulative = 15*6 = 90
	if values[9].Run != 2 {
		t.Errorf("day 10 run = %d, want 2", values[9].Run)
	}
	if math.Abs(values[9].CumulativeGDD-90) > 0.001 {
		t.Errorf("day 10 cumulative = %v, want 90", values[9].CumulativeGDD)
	}
}

func TestRecalculateGDDFetchesFromDB(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	startDate := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)
	_ = insertTestWeather(t, db, loc.ID, startDate, 10, 30.0, 20.0)

	m := &model.GDDModel{
		LocationID: loc.ID,
		Name:       "Auto-Fetch Test",
		BaseTemp:   10.0,
		Unit:       model.TempUnitC,
		StartDate:  startDate,
	}
	created, _ := dbpkg.CreateGDDModel(db, m)

	// Pass empty weather data — function should fetch from DB
	err := RecalculateGDDForModel(db, created, nil)
	if err != nil {
		t.Fatalf("RecalculateGDDForModel with nil weather failed: %v", err)
	}

	values, _ := dbpkg.GetGDDValues(db, created.ID)
	if len(values) == 0 {
		t.Error("expected GDD values after auto-fetch from DB, got 0")
	}
}

// --- Disease pressure tests ---

func TestCalculateAndStoreDisease(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	startDate := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)
	weatherData := insertTestWeather(t, db, loc.ID, startDate, 10, 28.0, 18.0)

	calculateAndStoreDisease(db, loc.ID, weatherData)

	// Verify disease pressure rows were created
	results, err := dbpkg.GetDiseasePressure(db, loc.ID, nil, nil)
	if err != nil {
		t.Fatalf("GetDiseasePressure failed: %v", err)
	}

	// First 4 days have nil (insufficient data for 5-day window), days 5-10 should have values
	if len(results) < 5 {
		t.Errorf("expected at least 5 disease pressure rows (days 5-10), got %d", len(results))
	}

	for _, r := range results {
		if r.RiskScore == nil {
			t.Errorf("expected non-nil risk score for date %s", r.Date.Format("2006-01-02"))
			continue
		}
		if *r.RiskScore < 0 || *r.RiskScore > 1 {
			t.Errorf("risk score %v out of range [0,1] for date %s", *r.RiskScore, r.Date.Format("2006-01-02"))
		}
	}
}

// --- Growth potential tests ---

func TestCalculateAndStoreGrowthPotential(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)
	_ = createTestLawn(t, db, loc.ID, model.GrassTypeCold)

	// Temp: max=22°C, min=18°C → avg=20°C (optimal for cold season → GP ≈ 1.0)
	startDate := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)
	weatherData := insertTestWeather(t, db, loc.ID, startDate, 10, 22.0, 18.0)

	calculateAndStoreGrowthPotential(db, loc.ID, weatherData)

	results, err := dbpkg.GetGrowthPotential(db, loc.ID, nil, nil)
	if err != nil {
		t.Fatalf("GetGrowthPotential failed: %v", err)
	}
	if len(results) != 10 {
		t.Fatalf("expected 10 growth potential rows, got %d", len(results))
	}

	// At optimal temp (20°C for cold season), GP should be very close to 1.0
	for _, r := range results {
		if r.GrowthPotential == nil {
			t.Error("expected non-nil growth potential")
			continue
		}
		if *r.GrowthPotential < 0.95 {
			t.Errorf("expected GP near 1.0 at optimal temp, got %v", *r.GrowthPotential)
		}
	}
}

func TestCalculateAndStoreGrowthPotentialWarmSeason(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)
	_ = createTestLawn(t, db, loc.ID, model.GrassTypeWarm)

	// Temp: max=33°C, min=29°C → avg=31°C (optimal for warm season → GP ≈ 1.0)
	startDate := time.Date(2025, 7, 1, 0, 0, 0, 0, time.UTC)
	weatherData := insertTestWeather(t, db, loc.ID, startDate, 10, 33.0, 29.0)

	calculateAndStoreGrowthPotential(db, loc.ID, weatherData)

	results, _ := dbpkg.GetGrowthPotential(db, loc.ID, nil, nil)
	if len(results) != 10 {
		t.Fatalf("expected 10 rows, got %d", len(results))
	}
	for _, r := range results {
		if r.GrowthPotential != nil && *r.GrowthPotential < 0.95 {
			t.Errorf("expected GP near 1.0 at optimal warm temp, got %v", *r.GrowthPotential)
		}
	}
}

// --- Water summaries tests ---

func TestCalculateWaterSummaries(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)
	lawn := createTestLawn(t, db, loc.ID, model.GrassTypeCold)

	// Insert 21 days of weather (3 full weeks)
	startDate := time.Date(2025, 6, 2, 0, 0, 0, 0, time.UTC) // Monday
	_ = insertTestWeather(t, db, loc.ID, startDate, 21, 30.0, 20.0)

	endDate := startDate.AddDate(0, 0, 21)
	calculateWaterSummaries(db, loc.ID, startDate, endDate)

	summaries, err := dbpkg.GetWeeklyWaterSummaries(db, lawn.ID)
	if err != nil {
		t.Fatalf("GetWeeklyWaterSummaries failed: %v", err)
	}
	if len(summaries) < 3 {
		t.Errorf("expected at least 3 weekly summaries, got %d", len(summaries))
	}

	for _, s := range summaries {
		// Each week: 7 days * ET0 in inches, 7 days * precip in inches
		// Status should be computed from WaterBalance
		if s.Status == "" {
			t.Error("expected non-empty status")
		}
		if s.WeekEnd.Before(s.WeekStart) {
			t.Errorf("week_end %v before week_start %v", s.WeekEnd, s.WeekStart)
		}
	}
}

// --- runCalculations integration test ---

func TestRunCalculationsStartup(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)
	_ = createTestLawn(t, db, loc.ID, model.GrassTypeCold)

	// Use dates relative to now so they fall within the 60-day calculation window
	today := time.Now().UTC().Truncate(24 * time.Hour)
	startDate := today.AddDate(0, 0, -30)

	// Create GDD model
	m := &model.GDDModel{
		LocationID: loc.ID,
		Name:       "Integration Test",
		BaseTemp:   10.0,
		Unit:       model.TempUnitC,
		StartDate:  startDate,
	}
	_, err := dbpkg.CreateGDDModel(db, m)
	if err != nil {
		t.Fatalf("CreateGDDModel failed: %v", err)
	}

	// Insert weather data within the 60-day window
	_ = insertTestWeather(t, db, loc.ID, startDate, 30, 28.0, 18.0)

	// Run startup calculations (isRecurring=false)
	runCalculations(db, *loc, false)

	// Verify disease pressure was calculated
	diseaseResults, _ := dbpkg.GetDiseasePressure(db, loc.ID, nil, nil)
	if len(diseaseResults) == 0 {
		t.Error("expected disease pressure results after runCalculations")
	}

	// Verify growth potential was calculated
	gpResults, _ := dbpkg.GetGrowthPotential(db, loc.ID, nil, nil)
	if len(gpResults) == 0 {
		t.Error("expected growth potential results after runCalculations")
	}

	// Verify GDD was calculated
	gddValues, _ := dbpkg.GetGDDValues(db, m.ID)
	if len(gddValues) == 0 {
		t.Error("expected GDD values after runCalculations")
	}
}

// --- nextUpdateTime tests ---

func TestNextUpdateTimeDefaultHour(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	// No settings → default to 6 AM America/Chicago
	next := nextUpdateTime(db)

	now := time.Now()
	if !next.After(now) {
		t.Errorf("nextUpdateTime should return a future time, got %v (now=%v)", next, now)
	}

	// Verify it uses hour 6 in America/Chicago
	loc, _ := time.LoadLocation("America/Chicago")
	inTZ := next.In(loc)
	if inTZ.Hour() != 6 {
		t.Errorf("expected hour 6 in America/Chicago, got %d", inTZ.Hour())
	}
	if inTZ.Minute() != 0 || inTZ.Second() != 0 {
		t.Errorf("expected 0 minutes and 0 seconds, got %d:%d", inTZ.Minute(), inTZ.Second())
	}
}

func TestNextUpdateTimeConfiguredHour(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	// Set custom hour
	if err := dbpkg.SetSetting(db, "weather_update_hour", "14"); err != nil {
		t.Fatalf("SetSetting failed: %v", err)
	}

	next := nextUpdateTime(db)

	now := time.Now()
	if !next.After(now) {
		t.Errorf("nextUpdateTime should return a future time, got %v (now=%v)", next, now)
	}

	loc, _ := time.LoadLocation("America/Chicago")
	inTZ := next.In(loc)
	if inTZ.Hour() != 14 {
		t.Errorf("expected hour 14, got %d", inTZ.Hour())
	}
}

func TestNextUpdateTimeAlreadyPassedToday(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	// Use the current hour minus 1 to guarantee the time has passed
	loc, _ := time.LoadLocation("America/Chicago")
	currentHour := time.Now().In(loc).Hour()
	pastHour := currentHour - 1
	if pastHour < 0 {
		pastHour = 0
	}

	if err := dbpkg.SetSetting(db, "weather_update_hour", fmt.Sprintf("%d", pastHour)); err != nil {
		t.Fatalf("SetSetting failed: %v", err)
	}

	// If the hour already passed and it's not the same minute, next should be tomorrow
	// (unless currentHour == 0 and pastHour == 0, which might be the same)
	next := nextUpdateTime(db)
	now := time.Now()

	if !next.After(now) {
		t.Errorf("nextUpdateTime should return a future time when hour has passed, got %v (now=%v)", next, now)
	}

	inTZ := next.In(loc)
	today := now.In(loc)

	// If past hour < current hour, next should be tomorrow
	if pastHour < currentHour {
		if inTZ.Day() == today.Day() && inTZ.Month() == today.Month() {
			t.Errorf("expected tomorrow when hour has passed, got same day")
		}
	}
}

func TestNextUpdateTimeCustomTimezone(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	if err := dbpkg.SetSetting(db, "weather_update_hour", "12"); err != nil {
		t.Fatalf("SetSetting failed: %v", err)
	}
	if err := dbpkg.SetSetting(db, "weather_update_timezone", "America/New_York"); err != nil {
		t.Fatalf("SetSetting failed: %v", err)
	}

	next := nextUpdateTime(db)

	now := time.Now()
	if !next.After(now) {
		t.Errorf("nextUpdateTime should return a future time, got %v (now=%v)", next, now)
	}

	loc, _ := time.LoadLocation("America/New_York")
	inTZ := next.In(loc)
	if inTZ.Hour() != 12 {
		t.Errorf("expected hour 12 in America/New_York, got %d", inTZ.Hour())
	}
}

// --- runCalculations isRecurring=true test ---

func TestRunCalculationsRecurring(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)
	_ = createTestLawn(t, db, loc.ID, model.GrassTypeCold)

	today := time.Now().UTC().Truncate(24 * time.Hour)
	startDate := today.AddDate(0, 0, -30)

	// Create GDD model
	m := &model.GDDModel{
		LocationID: loc.ID,
		Name:       "Recurring Test",
		BaseTemp:   10.0,
		Unit:       model.TempUnitC,
		StartDate:  startDate,
	}
	_, err := dbpkg.CreateGDDModel(db, m)
	if err != nil {
		t.Fatalf("CreateGDDModel failed: %v", err)
	}

	// Insert weather data covering the full range needed by recurring calculations
	// Recurring mode uses different windows: -10 days for disease/GP, Jan 1 for weed, -14 for water
	jan1 := time.Date(today.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
	dayCount := int(today.Sub(jan1).Hours()/24) + 16 // Jan 1 through today + 15 forecast days
	_ = insertTestWeather(t, db, loc.ID, jan1, dayCount, 28.0, 18.0)

	// Run recurring calculations (isRecurring=true → optimized windows branch)
	runCalculations(db, *loc, true)

	// Verify disease pressure was calculated
	diseaseResults, _ := dbpkg.GetDiseasePressure(db, loc.ID, nil, nil)
	if len(diseaseResults) == 0 {
		t.Error("expected disease pressure results after recurring runCalculations")
	}

	// Verify growth potential was calculated
	gpResults, _ := dbpkg.GetGrowthPotential(db, loc.ID, nil, nil)
	if len(gpResults) == 0 {
		t.Error("expected growth potential results after recurring runCalculations")
	}

	// Verify GDD was calculated
	gddValues, _ := dbpkg.GetGDDValues(db, m.ID)
	if len(gddValues) == 0 {
		t.Error("expected GDD values after recurring runCalculations")
	}
}

// --- fetchAndStoreWeather test with mock HTTP server ---

// makeOpenMeteoForecastResponse builds a valid OpenMeteo forecast JSON response for the given dates.
func makeOpenMeteoForecastResponse(dates []string) []byte {
	type dailyBlock struct {
		Time                        []string  `json:"time"`
		Temperature2mMax            []float64 `json:"temperature_2m_max"`
		Temperature2mMin            []float64 `json:"temperature_2m_min"`
		PrecipitationSum            []float64 `json:"precipitation_sum"`
		PrecipitationProbabilityMax []float64 `json:"precipitation_probability_max"`
		Windspeed10mMax             []float64 `json:"windspeed_10m_max"`
		Windgusts10mMax             []float64 `json:"windgusts_10m_max"`
		WinddirectionDominant       []float64 `json:"winddirection_10m_dominant"`
		ET0Evapotranspiration       []float64 `json:"et0_fao_evapotranspiration"`
		RelativeHumidity2mMean      []float64 `json:"relative_humidity_2m_mean"`
		RelativeHumidity2mMax       []float64 `json:"relative_humidity_2m_max"`
		RelativeHumidity2mMin       []float64 `json:"relative_humidity_2m_min"`
		DewPoint2mMax               []float64 `json:"dew_point_2m_max"`
		DewPoint2mMin               []float64 `json:"dew_point_2m_min"`
		DewPoint2mMean              []float64 `json:"dew_point_2m_mean"`
		SunshineDuration            []float64 `json:"sunshine_duration"`
	}
	type resp struct {
		Daily dailyBlock `json:"daily"`
	}

	n := len(dates)
	r := resp{}
	r.Daily.Time = dates
	r.Daily.Temperature2mMax = make([]float64, n)
	r.Daily.Temperature2mMin = make([]float64, n)
	r.Daily.PrecipitationSum = make([]float64, n)
	r.Daily.PrecipitationProbabilityMax = make([]float64, n)
	r.Daily.Windspeed10mMax = make([]float64, n)
	r.Daily.Windgusts10mMax = make([]float64, n)
	r.Daily.WinddirectionDominant = make([]float64, n)
	r.Daily.ET0Evapotranspiration = make([]float64, n)
	r.Daily.RelativeHumidity2mMean = make([]float64, n)
	r.Daily.RelativeHumidity2mMax = make([]float64, n)
	r.Daily.RelativeHumidity2mMin = make([]float64, n)
	r.Daily.DewPoint2mMax = make([]float64, n)
	r.Daily.DewPoint2mMin = make([]float64, n)
	r.Daily.DewPoint2mMean = make([]float64, n)
	r.Daily.SunshineDuration = make([]float64, n)

	for i := range dates {
		r.Daily.Temperature2mMax[i] = 30.0
		r.Daily.Temperature2mMin[i] = 20.0
		r.Daily.PrecipitationSum[i] = 2.0
		r.Daily.Windspeed10mMax[i] = 3.0
		r.Daily.Windgusts10mMax[i] = 6.0
		r.Daily.WinddirectionDominant[i] = 180.0
		r.Daily.ET0Evapotranspiration[i] = 4.0
		r.Daily.RelativeHumidity2mMean[i] = 70.0
		r.Daily.RelativeHumidity2mMax[i] = 85.0
		r.Daily.RelativeHumidity2mMin[i] = 55.0
	}

	b, _ := json.Marshal(r)
	return b
}

func TestFetchAndStoreWeather(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	loc := createTestLocation(t, db)

	today := time.Now().UTC().Truncate(24 * time.Hour)
	pastDays := 5
	forecastDays := 15

	// Generate date strings for the mock response
	var dates []string
	startDate := today.AddDate(0, 0, -pastDays)
	totalDays := pastDays + forecastDays
	for i := 0; i < totalDays; i++ {
		d := startDate.AddDate(0, 0, i)
		dates = append(dates, d.Format("2006-01-02"))
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write(makeOpenMeteoForecastResponse(dates)) //nolint:errcheck
	}))
	defer server.Close()

	client := &weather.Client{
		HTTPClient: server.Client(),
		BaseURL:    server.URL,
	}

	err := fetchAndStoreWeather(db, client, *loc, today, pastDays)
	if err != nil {
		t.Fatalf("fetchAndStoreWeather failed: %v", err)
	}

	// Verify weather data was stored in the database
	s := startDate
	e := today.AddDate(0, 0, forecastDays)
	storedWeather, err := dbpkg.GetWeatherForLocation(db, loc.ID, &s, &e)
	if err != nil {
		t.Fatalf("GetWeatherForLocation failed: %v", err)
	}

	if len(storedWeather) == 0 {
		t.Fatal("expected weather data to be stored in DB, got 0 rows")
	}

	// Verify at least some data matches what we sent
	if len(storedWeather) < pastDays {
		t.Errorf("expected at least %d weather rows, got %d", pastDays, len(storedWeather))
	}

	// Verify temperature values are correct
	for _, w := range storedWeather {
		if math.Abs(w.TemperatureMaxC-30.0) > 0.01 {
			t.Errorf("expected tmax=30.0, got %v for date %s", w.TemperatureMaxC, w.Date.Format("2006-01-02"))
			break
		}
		if math.Abs(w.TemperatureMinC-20.0) > 0.01 {
			t.Errorf("expected tmin=20.0, got %v for date %s", w.TemperatureMinC, w.Date.Format("2006-01-02"))
			break
		}
	}

	// Verify historical vs forecast type assignment
	for _, w := range storedWeather {
		if w.Date.After(today) {
			if w.Type != model.WeatherForecast {
				t.Errorf("expected forecast type for future date %s, got %s", w.Date.Format("2006-01-02"), w.Type)
				break
			}
		} else {
			if w.Type != model.WeatherHistorical {
				t.Errorf("expected historical type for past date %s, got %s", w.Date.Format("2006-01-02"), w.Type)
				break
			}
		}
	}
}

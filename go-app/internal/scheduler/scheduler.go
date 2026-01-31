// Package scheduler runs background tasks on a cron schedule.
// Replaces Celery + Redis + Beat with a simple in-process goroutine.
package scheduler

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/calc"
	dbpkg "github.com/RunOnYourOwn/TurfTrack/go-app/internal/db"
	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/model"
	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/weather"
)

// Start launches the background scheduler that runs daily weather updates.
func Start(db *sql.DB) {
	go func() {
		// Run once on startup after a brief delay
		time.Sleep(10 * time.Second)
		runDailyUpdate(db)

		// Then run at 09:00 UTC daily (same as original Celery schedule)
		for {
			now := time.Now().UTC()
			next := time.Date(now.Year(), now.Month(), now.Day(), 9, 0, 0, 0, time.UTC)
			if now.After(next) {
				next = next.Add(24 * time.Hour)
			}
			sleepDur := time.Until(next)
			log.Printf("[scheduler] Next weather update at %s (in %s)", next.Format(time.RFC3339), sleepDur)
			time.Sleep(sleepDur)
			runDailyUpdate(db)
		}
	}()
}

func runDailyUpdate(db *sql.DB) {
	log.Println("[scheduler] Starting daily weather update for all locations")

	locs, err := dbpkg.ListLocations(db)
	if err != nil {
		log.Printf("[scheduler] Failed to list locations: %v", err)
		return
	}

	client := weather.NewClient()
	today := time.Now().UTC().Truncate(24 * time.Hour)
	histStart := today.AddDate(0, 0, -60)
	forecastEnd := today.AddDate(0, 0, 16)

	for _, loc := range locs {
		taskID := fmt.Sprintf("weather-%d-%s", loc.ID, today.Format("20060102"))
		locID := loc.ID
		_ = dbpkg.CreateTaskStatus(db, taskID, "update_weather", &locID)

		if err := fetchAndStoreWeather(db, client, loc, histStart, today, forecastEnd); err != nil {
			log.Printf("[scheduler] Weather update failed for location %d: %v", loc.ID, err)
			errStr := err.Error()
			_ = dbpkg.UpdateTaskStatus(db, taskID, model.TaskFailure, nil, &errStr)
			continue
		}

		// Run cascade calculations
		runCalculations(db, loc)

		result := "Weather updated and calculations complete"
		_ = dbpkg.UpdateTaskStatus(db, taskID, model.TaskSuccess, &result, nil)
		log.Printf("[scheduler] Completed update for location %d (%s)", loc.ID, loc.Name)
	}

	log.Println("[scheduler] Daily update complete")
}

func fetchAndStoreWeather(db *sql.DB, client *weather.Client, loc model.Location,
	histStart, today, forecastEnd time.Time) error {

	// Fetch historical data
	histDays, err := client.FetchDailyWeather(loc.Latitude, loc.Longitude, histStart, today)
	if err != nil {
		return fmt.Errorf("historical fetch: %w", err)
	}
	for _, day := range histDays {
		if err := dbpkg.UpsertDailyWeather(db, loc.ID, day, model.WeatherHistorical); err != nil {
			log.Printf("[scheduler] Failed to upsert historical weather for %s: %v", day.Date.Format("2006-01-02"), err)
		}
	}

	// Fetch forecast data
	fcDays, err := client.FetchDailyWeather(loc.Latitude, loc.Longitude, today.AddDate(0, 0, 1), forecastEnd)
	if err != nil {
		return fmt.Errorf("forecast fetch: %w", err)
	}
	for _, day := range fcDays {
		if err := dbpkg.UpsertDailyWeather(db, loc.ID, day, model.WeatherForecast); err != nil {
			log.Printf("[scheduler] Failed to upsert forecast weather for %s: %v", day.Date.Format("2006-01-02"), err)
		}
	}

	return nil
}

func runCalculations(db *sql.DB, loc model.Location) {
	today := time.Now().UTC().Truncate(24 * time.Hour)
	start := today.AddDate(0, 0, -60)
	end := today.AddDate(0, 0, 16)

	// Get weather data for calculations
	weatherData, err := dbpkg.GetWeatherForLocation(db, loc.ID, &start, &end)
	if err != nil {
		log.Printf("[scheduler] Failed to get weather for calculations: %v", err)
		return
	}

	// Calculate disease pressure (Smith-Kerns)
	calculateAndStoreDisease(db, loc.ID, weatherData)

	// Calculate growth potential
	calculateAndStoreGrowthPotential(db, loc.ID, weatherData)

	// Recalculate GDD for all models at this location
	recalculateGDD(db, loc.ID, weatherData)

	// Calculate water summaries for all lawns at this location
	calculateWaterSummaries(db, loc.ID, start, end)
}

func calculateAndStoreDisease(db *sql.DB, locationID int, weatherData []model.DailyWeather) {
	days := make([]calc.DiseaseWeatherDay, len(weatherData))
	for i, w := range weatherData {
		avgTemp := (w.TemperatureMaxC + w.TemperatureMinC) / 2
		rh := 50.0
		if w.RelativeHumidityMean != nil {
			rh = *w.RelativeHumidityMean
		}
		days[i] = calc.DiseaseWeatherDay{AvgTempC: avgTemp, RelativeHumidity: rh}
	}

	risks := calc.CalculateDiseasePressure(days)

	for i, risk := range risks {
		if risk == nil {
			continue
		}
		date := weatherData[i].Date
		_, err := db.Exec(`
			INSERT INTO disease_pressure (date, location_id, disease, risk_score)
			VALUES ($1, $2, 'smith_kerns', $3)
			ON CONFLICT (date, location_id, disease) DO UPDATE SET risk_score=EXCLUDED.risk_score`,
			date, locationID, *risk)
		if err != nil {
			log.Printf("[scheduler] Failed to store disease pressure: %v", err)
		}
	}
}

func calculateAndStoreGrowthPotential(db *sql.DB, locationID int, weatherData []model.DailyWeather) {
	// Get grass type from first lawn at location
	var grassType string
	err := db.QueryRow("SELECT grass_type FROM lawns WHERE location_id = $1 LIMIT 1", locationID).Scan(&grassType)
	if err != nil {
		return
	}

	gt := calc.GrassTypeCold
	if grassType == "warm_season" {
		gt = calc.GrassTypeWarm
	}

	gpValues := make([]float64, len(weatherData))
	for i, w := range weatherData {
		avgTemp := (w.TemperatureMaxC + w.TemperatureMinC) / 2
		gpValues[i] = calc.GrowthPotentialScore(avgTemp, gt)
	}

	avg3 := calc.RollingAverage(gpValues, 3)
	avg5 := calc.RollingAverage(gpValues, 5)
	avg7 := calc.RollingAverage(gpValues, 7)

	for i, w := range weatherData {
		gp := gpValues[i]
		_, err := db.Exec(`
			INSERT INTO growth_potential (date, location_id, growth_potential, gp_3d_avg, gp_5d_avg, gp_7d_avg)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (location_id, date) DO UPDATE SET
				growth_potential=EXCLUDED.growth_potential,
				gp_3d_avg=EXCLUDED.gp_3d_avg,
				gp_5d_avg=EXCLUDED.gp_5d_avg,
				gp_7d_avg=EXCLUDED.gp_7d_avg`,
			w.Date, locationID, gp, avg3[i], avg5[i], avg7[i])
		if err != nil {
			log.Printf("[scheduler] Failed to store growth potential: %v", err)
		}
	}
}

func recalculateGDD(db *sql.DB, locationID int, weatherData []model.DailyWeather) {
	models, err := dbpkg.ListGDDModels(db, &locationID)
	if err != nil {
		log.Printf("[scheduler] Failed to list GDD models: %v", err)
		return
	}

	for _, m := range models {
		// Filter weather data from model start date
		var days []calc.WeatherDay
		var dates []time.Time
		var forecasts []bool
		for _, w := range weatherData {
			if !w.Date.Before(m.StartDate) {
				tmax := w.TemperatureMaxC
				tmin := w.TemperatureMinC
				if m.Unit == model.TempUnitF {
					// Weather is stored in C, but model uses F base temp
					// Convert weather to F for calculation
					tmax = weather.CtoF(tmax)
					tmin = weather.CtoF(tmin)
				}
				days = append(days, calc.WeatherDay{TmaxC: tmax, TminC: tmin})
				dates = append(dates, w.Date)
				forecasts = append(forecasts, w.Type == model.WeatherForecast)
			}
		}

		results := calc.CalculateGDDSeries(days, m.BaseTemp, m.Threshold, m.ResetOnThreshold)

		values := make([]struct {
			Date          time.Time
			DailyGDD      float64
			CumulativeGDD float64
			IsForecast    bool
			Run           int
		}, len(results))
		for i, r := range results {
			values[i].Date = dates[i]
			values[i].DailyGDD = r.DailyGDD
			values[i].CumulativeGDD = r.CumulativeGDD
			values[i].IsForecast = forecasts[i]
			values[i].Run = r.Run
		}

		if err := dbpkg.UpsertGDDValues(db, m.ID, values); err != nil {
			log.Printf("[scheduler] Failed to store GDD values for model %d: %v", m.ID, err)
		}
	}
}

func calculateWaterSummaries(db *sql.DB, locationID int, start, end time.Time) {
	rows, err := db.Query("SELECT id FROM lawns WHERE location_id = $1", locationID)
	if err != nil {
		return
	}
	defer rows.Close() //nolint:errcheck

	var lawnIDs []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err == nil {
			lawnIDs = append(lawnIDs, id)
		}
	}

	for _, lawnID := range lawnIDs {
		calculateWaterForLawn(db, lawnID, locationID, start, end)
	}
}

func calculateWaterForLawn(db *sql.DB, lawnID, locationID int, start, end time.Time) {
	// Generate Monday-Sunday weeks
	weekStart := start
	for weekStart.Weekday() != time.Monday {
		weekStart = weekStart.AddDate(0, 0, -1)
	}

	for weekStart.Before(end) {
		weekEnd := weekStart.AddDate(0, 0, 6) // Sunday

		// Sum ET0 and precipitation for the week
		var et0Total, precipTotal float64
		var hasForecast bool
		err := db.QueryRow(`
			SELECT COALESCE(SUM(et0_evapotranspiration_in), 0),
			       COALESCE(SUM(precipitation_in), 0),
			       BOOL_OR(type = 'forecast')
			FROM daily_weather
			WHERE location_id = $1 AND date >= $2 AND date <= $3`,
			locationID, weekStart, weekEnd).Scan(&et0Total, &precipTotal, &hasForecast)
		if err != nil {
			weekStart = weekStart.AddDate(0, 0, 7)
			continue
		}

		// Sum irrigation for this lawn in the week
		var irrigTotal float64
		_ = db.QueryRow(`
			SELECT COALESCE(SUM(amount), 0) FROM irrigation_entries
			WHERE lawn_id = $1 AND date >= $2 AND date <= $3`,
			lawnID, weekStart, weekEnd).Scan(&irrigTotal)

		deficit, status := calc.WaterBalance(et0Total, precipTotal, irrigTotal)

		_, err = db.Exec(`
			INSERT INTO weekly_water_summaries (lawn_id, week_start, week_end, et0_total, precipitation_total,
				irrigation_applied, water_deficit, status, is_forecast, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
			ON CONFLICT (lawn_id, week_start) DO UPDATE SET
				week_end=EXCLUDED.week_end, et0_total=EXCLUDED.et0_total,
				precipitation_total=EXCLUDED.precipitation_total, irrigation_applied=EXCLUDED.irrigation_applied,
				water_deficit=EXCLUDED.water_deficit, status=EXCLUDED.status,
				is_forecast=EXCLUDED.is_forecast, updated_at=NOW()`,
			lawnID, weekStart, weekEnd, et0Total, precipTotal, irrigTotal, deficit, status, hasForecast)
		if err != nil {
			log.Printf("[scheduler] Failed to store water summary: %v", err)
		}

		weekStart = weekStart.AddDate(0, 0, 7)
	}
}

// FetchWeatherForLocation can be called on-demand (e.g., when creating a new lawn).
func FetchWeatherForLocation(db *sql.DB, loc model.Location) {
	go func() {
		client := weather.NewClient()
		today := time.Now().UTC().Truncate(24 * time.Hour)
		histStart := today.AddDate(0, 0, -60)
		forecastEnd := today.AddDate(0, 0, 16)

		if err := fetchAndStoreWeather(db, client, loc, histStart, today, forecastEnd); err != nil {
			log.Printf("[scheduler] On-demand weather fetch failed for location %d: %v", loc.ID, err)
			return
		}
		runCalculations(db, loc)
	}()
}

// Package scheduler runs background tasks on a cron schedule.
// Replaces Celery + Redis + Beat with a simple in-process goroutine.
package scheduler

import (
	"database/sql"
	"fmt"
	"log"
	"strconv"
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
		runDailyUpdate(db, false)

		// Then run at the configured hour daily
		for {
			next := nextUpdateTime(db)
			sleepDur := time.Until(next)
			log.Printf("[scheduler] Next weather update at %s (in %s)", next.Format(time.RFC3339), sleepDur)
			time.Sleep(sleepDur)
			runDailyUpdate(db, true)
		}
	}()
}

// nextUpdateTime reads the configured update hour and timezone from app_settings.
func nextUpdateTime(db *sql.DB) time.Time {
	hour := 6 // default 6 AM
	tzName := "America/Chicago"

	if h, err := dbpkg.GetSetting(db, "weather_update_hour"); err == nil {
		if v, err := strconv.Atoi(h); err == nil && v >= 0 && v <= 23 {
			hour = v
		}
	}
	if tz, err := dbpkg.GetSetting(db, "weather_update_timezone"); err == nil && tz != "" {
		tzName = tz
	}

	loc, err := time.LoadLocation(tzName)
	if err != nil {
		loc = time.UTC
	}

	now := time.Now().In(loc)
	next := time.Date(now.Year(), now.Month(), now.Day(), hour, 0, 0, 0, loc)
	if now.After(next) {
		next = next.Add(24 * time.Hour)
	}
	return next
}

func runDailyUpdate(db *sql.DB, isRecurring bool) {
	log.Println("[scheduler] Starting daily weather update for all locations")

	locs, err := dbpkg.ListLocations(db)
	if err != nil {
		log.Printf("[scheduler] Failed to list locations: %v", err)
		return
	}

	client := weather.NewClient()
	today := time.Now().UTC().Truncate(24 * time.Hour)

	// On recurring daily runs, only fetch 2 days back (yesterday's actuals + today)
	// On startup, fetch 60 days to backfill if needed
	pastDays := 60
	if isRecurring {
		pastDays = 2
	}

	for _, loc := range locs {
		taskID := fmt.Sprintf("weather-%d-%s", loc.ID, today.Format("20060102"))
		locID := loc.ID
		_ = dbpkg.CreateTaskStatus(db, taskID, "update_weather", &locID)

		if err := fetchAndStoreWeather(db, client, loc, today, pastDays); err != nil {
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

func fetchAndStoreWeather(db *sql.DB, client *weather.Client, loc model.Location, today time.Time, pastDays int) error {
	// Single API call: pastDays historical + 15 days forecast
	days, err := client.FetchDailyWeather(loc.Latitude, loc.Longitude, pastDays, 15)
	if err != nil {
		return fmt.Errorf("weather fetch: %w", err)
	}

	for _, day := range days {
		// Determine type based on whether date is in the past or future
		weatherType := model.WeatherHistorical
		if day.Date.After(today) {
			weatherType = model.WeatherForecast
		}
		if err := dbpkg.UpsertDailyWeather(db, loc.ID, day, weatherType); err != nil {
			log.Printf("[scheduler] Failed to upsert weather for %s: %v", day.Date.Format("2006-01-02"), err)
		}
	}

	return nil
}

func runCalculations(db *sql.DB, loc model.Location) {
	today := time.Now().UTC().Truncate(24 * time.Hour)
	start := today.AddDate(0, 0, -60)
	end := today.AddDate(0, 0, 15)

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

	// Calculate weed pressure for all species at this location
	calculateAndStoreWeedPressure(db, loc.ID, weatherData)

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

func calculateAndStoreWeedPressure(db *sql.DB, locationID int, weatherData []model.DailyWeather) {
	species, err := dbpkg.ListWeedSpecies(db, true)
	if err != nil || len(species) == 0 {
		return
	}

	// Get grass type for growth potential (turf stress calculation)
	var grassType string
	_ = db.QueryRow("SELECT grass_type FROM lawns WHERE location_id = $1 LIMIT 1", locationID).Scan(&grassType)
	gt := calc.GrassTypeCold
	if grassType == "warm_season" {
		gt = calc.GrassTypeWarm
	}

	for _, sp := range species {
		// Accumulate GDD from Jan 1 for this species' base temp
		gddAccum := 0.0

		for i, w := range weatherData {
			date := w.Date
			month := int(date.Month())
			avgTemp := (w.TemperatureMaxC + w.TemperatureMinC) / 2

			// Reset GDD accumulation at year boundary
			if i > 0 && weatherData[i-1].Date.Year() != date.Year() {
				gddAccum = 0.0
			}

			// Daily GDD for this species' base temp
			dailyGDD := avgTemp - sp.GDDBaseTempC
			if dailyGDD < 0 {
				dailyGDD = 0
			}
			gddAccum += dailyGDD

			// Estimate soil temperature
			soilTemp := calc.EstimateSoilTemp(avgTemp, month)

			// 3-day precipitation sum (current day + 2 prior)
			precip3d := w.PrecipitationMM
			for j := 1; j <= 2 && i-j >= 0; j++ {
				precip3d += weatherData[i-j].PrecipitationMM
			}

			// 7-day humidity average
			humCount := 0
			humSum := 0.0
			for j := 0; j < 7 && i-j >= 0; j++ {
				if weatherData[i-j].RelativeHumidityMean != nil {
					humSum += *weatherData[i-j].RelativeHumidityMean
					humCount++
				}
			}
			humAvg := 50.0 // default
			if humCount > 0 {
				humAvg = humSum / float64(humCount)
			}

			// Turf stress: drought stress (ET0 - precip) + inverse growth potential
			et0 := w.ET0MM
			droughtStress := 0.0
			if et0 > w.PrecipitationMM {
				deficit := et0 - w.PrecipitationMM
				if deficit > 5 {
					droughtStress = 1.0
				} else if deficit > 2 {
					droughtStress = 0.5
				}
			}
			gp := calc.GrowthPotentialScore(avgTemp, gt)
			gpStress := 1.0 - gp // low GP = high stress
			turfStress := droughtStress + gpStress
			if turfStress > 2.0 {
				turfStress = 2.0
			}

			// Component scores
			gddRisk := calc.GDDRisk(gddAccum, sp.GDDThresholdEmergence)
			soilTempRisk := calc.SoilTempRisk(soilTemp, sp.OptimalSoilTempMinC, sp.OptimalSoilTempMaxC)
			moistureRisk := calc.MoistureRisk(precip3d, humAvg)
			seasonalTiming := calc.SeasonalTiming(month, calc.WeedSeasonType(sp.Season))
			composite := calc.CompositeWeedPressure(gddRisk, soilTempRisk, moistureRisk, turfStress, seasonalTiming)

			isForecast := w.Type == model.WeatherForecast

			_, err := db.Exec(`
				INSERT INTO weed_pressure (location_id, date, weed_species_id,
					weed_pressure_score, gdd_risk_score, soil_temp_risk_score,
					moisture_risk_score, turf_stress_score, seasonal_timing_score,
					gdd_accumulated, soil_temp_estimate_c, precipitation_3day_mm,
					humidity_avg, et0_mm, is_forecast)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
				ON CONFLICT (location_id, date, weed_species_id) DO UPDATE SET
					weed_pressure_score=EXCLUDED.weed_pressure_score,
					gdd_risk_score=EXCLUDED.gdd_risk_score,
					soil_temp_risk_score=EXCLUDED.soil_temp_risk_score,
					moisture_risk_score=EXCLUDED.moisture_risk_score,
					turf_stress_score=EXCLUDED.turf_stress_score,
					seasonal_timing_score=EXCLUDED.seasonal_timing_score,
					gdd_accumulated=EXCLUDED.gdd_accumulated,
					soil_temp_estimate_c=EXCLUDED.soil_temp_estimate_c,
					precipitation_3day_mm=EXCLUDED.precipitation_3day_mm,
					humidity_avg=EXCLUDED.humidity_avg,
					et0_mm=EXCLUDED.et0_mm,
					is_forecast=EXCLUDED.is_forecast`,
				locationID, date, sp.ID,
				composite, gddRisk, soilTempRisk,
				moistureRisk, turfStress, seasonalTiming,
				gddAccum, soilTemp, precip3d,
				humAvg, et0, isForecast)
			if err != nil {
				log.Printf("[scheduler] Failed to store weed pressure for %s/%s: %v", sp.Name, date.Format("2006-01-02"), err)
			}
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

		taskID := fmt.Sprintf("weather-%d-%s-ondemand", loc.ID, today.Format("20060102"))
		locID := loc.ID
		_ = dbpkg.CreateTaskStatus(db, taskID, "update_weather", &locID)

		if err := fetchAndStoreWeather(db, client, loc, today, 60); err != nil {
			log.Printf("[scheduler] On-demand weather fetch failed for location %d: %v", loc.ID, err)
			errStr := err.Error()
			_ = dbpkg.UpdateTaskStatus(db, taskID, model.TaskFailure, nil, &errStr)
			return
		}
		runCalculations(db, loc)

		result := "On-demand weather fetch and calculations complete"
		_ = dbpkg.UpdateTaskStatus(db, taskID, model.TaskSuccess, &result, nil)
		log.Printf("[scheduler] On-demand update complete for location %d (%s)", loc.ID, loc.Name)
	}()
}

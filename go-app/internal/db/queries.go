package db

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/model"
	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/weather"
)

// --- Locations ---

func ListLocations(db *sql.DB) ([]model.Location, error) {
	rows, err := db.Query("SELECT id, name, latitude, longitude FROM locations ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close() //nolint:errcheck

	var locs []model.Location
	for rows.Next() {
		var l model.Location
		if err := rows.Scan(&l.ID, &l.Name, &l.Latitude, &l.Longitude); err != nil {
			return nil, err
		}
		locs = append(locs, l)
	}
	return locs, rows.Err()
}

func GetLocation(db *sql.DB, id int) (*model.Location, error) {
	var l model.Location
	err := db.QueryRow("SELECT id, name, latitude, longitude FROM locations WHERE id = $1", id).
		Scan(&l.ID, &l.Name, &l.Latitude, &l.Longitude)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &l, err
}

func CreateLocation(db *sql.DB, name string, lat, lon float64) (*model.Location, error) {
	var l model.Location
	err := db.QueryRow(
		"INSERT INTO locations (name, latitude, longitude) VALUES ($1, $2, $3) RETURNING id, name, latitude, longitude",
		name, lat, lon,
	).Scan(&l.ID, &l.Name, &l.Latitude, &l.Longitude)
	return &l, err
}

func GetOrCreateLocation(db *sql.DB, lat, lon float64) (*model.Location, error) {
	var l model.Location
	err := db.QueryRow("SELECT id, name, latitude, longitude FROM locations WHERE latitude = $1 AND longitude = $2", lat, lon).
		Scan(&l.ID, &l.Name, &l.Latitude, &l.Longitude)
	if err == nil {
		return &l, nil
	}
	if err != sql.ErrNoRows {
		return nil, err
	}
	name := fmt.Sprintf("Location (%.4f, %.4f)", lat, lon)
	return CreateLocation(db, name, lat, lon)
}

// --- Lawns ---

func ListLawns(db *sql.DB) ([]model.Lawn, error) {
	rows, err := db.Query(`
		SELECT l.id, l.name, l.area, l.grass_type, l.notes,
		       l.weather_enabled, l.location_id, l.created_at, l.updated_at,
		       loc.id, loc.name, loc.latitude, loc.longitude
		FROM lawns l
		JOIN locations loc ON l.location_id = loc.id
		ORDER BY l.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close() //nolint:errcheck

	var lawns []model.Lawn
	for rows.Next() {
		var l model.Lawn
		var loc model.Location
		if err := rows.Scan(&l.ID, &l.Name, &l.Area, &l.GrassType, &l.Notes,
			&l.WeatherEnabled, &l.LocationID,
			&l.CreatedAt, &l.UpdatedAt,
			&loc.ID, &loc.Name, &loc.Latitude, &loc.Longitude); err != nil {
			return nil, err
		}
		l.Location = &loc
		lawns = append(lawns, l)
	}
	return lawns, rows.Err()
}

func GetLawn(db *sql.DB, id int) (*model.Lawn, error) {
	var l model.Lawn
	var loc model.Location
	err := db.QueryRow(`
		SELECT l.id, l.name, l.area, l.grass_type, l.notes,
		       l.weather_enabled, l.location_id, l.created_at, l.updated_at,
		       loc.id, loc.name, loc.latitude, loc.longitude
		FROM lawns l
		JOIN locations loc ON l.location_id = loc.id
		WHERE l.id = $1`, id).
		Scan(&l.ID, &l.Name, &l.Area, &l.GrassType, &l.Notes,
			&l.WeatherEnabled, &l.LocationID,
			&l.CreatedAt, &l.UpdatedAt,
			&loc.ID, &loc.Name, &loc.Latitude, &loc.Longitude)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	l.Location = &loc
	return &l, err
}

func CreateLawn(db *sql.DB, name string, area float64, grassType model.GrassType, notes string,
	weatherEnabled bool, locationID int) (*model.Lawn, error) {
	var l model.Lawn
	var notesVal sql.NullString
	if notes != "" {
		notesVal = sql.NullString{String: notes, Valid: true}
	}
	err := db.QueryRow(`
		INSERT INTO lawns (name, area, grass_type, notes, weather_enabled, location_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, name, area, grass_type, notes, weather_enabled, location_id, created_at, updated_at`,
		name, area, grassType, notesVal, weatherEnabled, locationID,
	).Scan(&l.ID, &l.Name, &l.Area, &l.GrassType, &l.Notes,
		&l.WeatherEnabled, &l.LocationID,
		&l.CreatedAt, &l.UpdatedAt)
	return &l, err
}

func UpdateLawn(db *sql.DB, id int, name string, area float64, grassType model.GrassType, notes string,
	weatherEnabled bool, locationID int) (*model.Lawn, error) {
	var l model.Lawn
	var notesVal sql.NullString
	if notes != "" {
		notesVal = sql.NullString{String: notes, Valid: true}
	}
	err := db.QueryRow(`
		UPDATE lawns SET name=$1, area=$2, grass_type=$3, notes=$4,
		       weather_enabled=$5, location_id=$6, updated_at=NOW()
		WHERE id=$7
		RETURNING id, name, area, grass_type, notes, weather_enabled, location_id, created_at, updated_at`,
		name, area, grassType, notesVal, weatherEnabled, locationID, id,
	).Scan(&l.ID, &l.Name, &l.Area, &l.GrassType, &l.Notes,
		&l.WeatherEnabled, &l.LocationID,
		&l.CreatedAt, &l.UpdatedAt)
	return &l, err
}

func DeleteLawn(db *sql.DB, id int) error {
	_, err := db.Exec("DELETE FROM lawns WHERE id = $1", id)
	return err
}

// DeleteOrphanedLocation deletes a location if no lawns reference it.
// The CASCADE rules on the location will clean up all related weather,
// disease, growth potential, GDD, and weed pressure data.
func DeleteOrphanedLocation(db *sql.DB, locationID int) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM lawns WHERE location_id = $1", locationID).Scan(&count)
	if err != nil || count > 0 {
		return
	}
	_, _ = db.Exec("DELETE FROM locations WHERE id = $1", locationID)
}

// --- Products ---

func ListProducts(db *sql.DB) ([]model.Product, error) {
	rows, err := db.Query(`
		SELECT id, name, n_pct, p_pct, k_pct, ca_pct, mg_pct, s_pct, fe_pct, cu_pct, mn_pct, b_pct, zn_pct,
		       weight_lbs, cost_per_bag, sgn, product_link, label, sources,
		       urea_nitrogen, ammoniacal_nitrogen, water_insol_nitrogen, other_water_soluble, slowly_available_from,
		       cost_per_lb_n, cost_per_lb, last_scraped_price, last_scraped_at, created_at, updated_at
		FROM products ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close() //nolint:errcheck

	var products []model.Product
	for rows.Next() {
		var p model.Product
		if err := rows.Scan(&p.ID, &p.Name, &p.NPct, &p.PPct, &p.KPct, &p.CaPct, &p.MgPct, &p.SPct,
			&p.FePct, &p.CuPct, &p.MnPct, &p.BPct, &p.ZnPct,
			&p.WeightLbs, &p.CostPerBag, &p.SGN, &p.ProductLink, &p.Label, &p.Sources,
			&p.UreaNitrogen, &p.AmmoniacalNitrogen, &p.WaterInsolNitrogen, &p.OtherWaterSoluble, &p.SlowlyAvailFrom,
			&p.CostPerLbN, &p.CostPerLb, &p.LastScrapedPrice, &p.LastScrapedAt, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		products = append(products, p)
	}
	return products, rows.Err()
}

func GetProduct(db *sql.DB, id int) (*model.Product, error) {
	var p model.Product
	err := db.QueryRow(`
		SELECT id, name, n_pct, p_pct, k_pct, ca_pct, mg_pct, s_pct, fe_pct, cu_pct, mn_pct, b_pct, zn_pct,
		       weight_lbs, cost_per_bag, sgn, product_link, label, sources,
		       urea_nitrogen, ammoniacal_nitrogen, water_insol_nitrogen, other_water_soluble, slowly_available_from,
		       cost_per_lb_n, cost_per_lb, last_scraped_price, last_scraped_at, created_at, updated_at
		FROM products WHERE id = $1`, id).
		Scan(&p.ID, &p.Name, &p.NPct, &p.PPct, &p.KPct, &p.CaPct, &p.MgPct, &p.SPct,
			&p.FePct, &p.CuPct, &p.MnPct, &p.BPct, &p.ZnPct,
			&p.WeightLbs, &p.CostPerBag, &p.SGN, &p.ProductLink, &p.Label, &p.Sources,
			&p.UreaNitrogen, &p.AmmoniacalNitrogen, &p.WaterInsolNitrogen, &p.OtherWaterSoluble, &p.SlowlyAvailFrom,
			&p.CostPerLbN, &p.CostPerLb, &p.LastScrapedPrice, &p.LastScrapedAt, &p.CreatedAt, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &p, err
}

func CreateProduct(db *sql.DB, p *model.Product) (*model.Product, error) {
	err := db.QueryRow(`
		INSERT INTO products (name, n_pct, p_pct, k_pct, ca_pct, mg_pct, s_pct, fe_pct, cu_pct, mn_pct, b_pct, zn_pct,
		                      weight_lbs, cost_per_bag, sgn, product_link, label, sources,
		                      urea_nitrogen, ammoniacal_nitrogen, water_insol_nitrogen, other_water_soluble, slowly_available_from)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
		RETURNING id, cost_per_lb_n, cost_per_lb, created_at, updated_at`,
		p.Name, p.NPct, p.PPct, p.KPct, p.CaPct, p.MgPct, p.SPct, p.FePct, p.CuPct, p.MnPct, p.BPct, p.ZnPct,
		p.WeightLbs, p.CostPerBag, p.SGN, p.ProductLink, p.Label, p.Sources,
		p.UreaNitrogen, p.AmmoniacalNitrogen, p.WaterInsolNitrogen, p.OtherWaterSoluble, p.SlowlyAvailFrom,
	).Scan(&p.ID, &p.CostPerLbN, &p.CostPerLb, &p.CreatedAt, &p.UpdatedAt)
	return p, err
}

func UpdateProduct(db *sql.DB, p *model.Product) (*model.Product, error) {
	err := db.QueryRow(`
		UPDATE products SET name=$1, n_pct=$2, p_pct=$3, k_pct=$4, ca_pct=$5, mg_pct=$6, s_pct=$7,
		       fe_pct=$8, cu_pct=$9, mn_pct=$10, b_pct=$11, zn_pct=$12,
		       weight_lbs=$13, cost_per_bag=$14, updated_at=NOW()
		WHERE id=$15
		RETURNING id, cost_per_lb_n, cost_per_lb, created_at, updated_at`,
		p.Name, p.NPct, p.PPct, p.KPct, p.CaPct, p.MgPct, p.SPct,
		p.FePct, p.CuPct, p.MnPct, p.BPct, p.ZnPct,
		p.WeightLbs, p.CostPerBag, p.ID,
	).Scan(&p.ID, &p.CostPerLbN, &p.CostPerLb, &p.CreatedAt, &p.UpdatedAt)
	return p, err
}

func DeleteProduct(db *sql.DB, id int) error {
	_, err := db.Exec("DELETE FROM products WHERE id = $1", id)
	return err
}

// --- Applications ---

func ListApplications(db *sql.DB, lawnID *int) ([]model.Application, error) {
	query := `SELECT id, lawn_id, product_id, application_date, amount_per_area, area_unit, unit, notes, status,
		tied_gdd_model_id, cost_applied, n_applied, p_applied, k_applied, ca_applied, mg_applied, s_applied,
		fe_applied, cu_applied, mn_applied, b_applied, zn_applied, created_at, updated_at
		FROM applications`
	var args []interface{}
	if lawnID != nil {
		query += " WHERE lawn_id = $1"
		args = append(args, *lawnID)
	}
	query += " ORDER BY application_date DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close() //nolint:errcheck

	var apps []model.Application
	for rows.Next() {
		var a model.Application
		if err := rows.Scan(&a.ID, &a.LawnID, &a.ProductID, &a.ApplicationDate, &a.AmountPerArea,
			&a.AreaUnit, &a.Unit, &a.Notes, &a.Status, &a.TiedGDDModelID,
			&a.CostApplied, &a.NApplied, &a.PApplied, &a.KApplied, &a.CaApplied, &a.MgApplied, &a.SApplied,
			&a.FeApplied, &a.CuApplied, &a.MnApplied, &a.BApplied, &a.ZnApplied,
			&a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		apps = append(apps, a)
	}
	return apps, rows.Err()
}

func CreateApplication(db *sql.DB, a *model.Application) (*model.Application, error) {
	err := db.QueryRow(`
		INSERT INTO applications (lawn_id, product_id, application_date, amount_per_area, area_unit, unit, notes, status,
			tied_gdd_model_id, cost_applied, n_applied, p_applied, k_applied, ca_applied, mg_applied, s_applied,
			fe_applied, cu_applied, mn_applied, b_applied, zn_applied)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
		RETURNING id, created_at, updated_at`,
		a.LawnID, a.ProductID, a.ApplicationDate, a.AmountPerArea, a.AreaUnit, a.Unit, a.Notes, a.Status,
		a.TiedGDDModelID, a.CostApplied, a.NApplied, a.PApplied, a.KApplied, a.CaApplied, a.MgApplied, a.SApplied,
		a.FeApplied, a.CuApplied, a.MnApplied, a.BApplied, a.ZnApplied,
	).Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt)
	return a, err
}

func GetApplication(db *sql.DB, id int) (*model.Application, error) {
	var a model.Application
	err := db.QueryRow(`SELECT id, lawn_id, product_id, application_date, amount_per_area, area_unit, unit, notes, status,
		tied_gdd_model_id, cost_applied, n_applied, p_applied, k_applied, ca_applied, mg_applied, s_applied,
		fe_applied, cu_applied, mn_applied, b_applied, zn_applied, created_at, updated_at
		FROM applications WHERE id = $1`, id).
		Scan(&a.ID, &a.LawnID, &a.ProductID, &a.ApplicationDate, &a.AmountPerArea,
			&a.AreaUnit, &a.Unit, &a.Notes, &a.Status, &a.TiedGDDModelID,
			&a.CostApplied, &a.NApplied, &a.PApplied, &a.KApplied, &a.CaApplied, &a.MgApplied, &a.SApplied,
			&a.FeApplied, &a.CuApplied, &a.MnApplied, &a.BApplied, &a.ZnApplied,
			&a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &a, err
}

func UpdateApplication(db *sql.DB, a *model.Application) (*model.Application, error) {
	err := db.QueryRow(`
		UPDATE applications SET lawn_id=$1, product_id=$2, application_date=$3, amount_per_area=$4,
		       area_unit=$5, unit=$6, notes=$7, status=$8, tied_gdd_model_id=$9,
		       cost_applied=$10, n_applied=$11, p_applied=$12, k_applied=$13, ca_applied=$14,
		       mg_applied=$15, s_applied=$16, fe_applied=$17, cu_applied=$18, mn_applied=$19,
		       b_applied=$20, zn_applied=$21, updated_at=NOW()
		WHERE id=$22
		RETURNING id, created_at, updated_at`,
		a.LawnID, a.ProductID, a.ApplicationDate, a.AmountPerArea,
		a.AreaUnit, a.Unit, a.Notes, a.Status, a.TiedGDDModelID,
		a.CostApplied, a.NApplied, a.PApplied, a.KApplied, a.CaApplied,
		a.MgApplied, a.SApplied, a.FeApplied, a.CuApplied, a.MnApplied,
		a.BApplied, a.ZnApplied, a.ID,
	).Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt)
	return a, err
}

func DeleteApplication(db *sql.DB, id int) error {
	_, err := db.Exec("DELETE FROM applications WHERE id = $1", id)
	return err
}

// --- Weather ---

func UpsertDailyWeather(db *sql.DB, locationID int, day weather.DailyData, weatherType model.WeatherType) error {
	tmaxF := weather.CtoF(day.TemperatureMaxC)
	tminF := weather.CtoF(day.TemperatureMinC)
	precipIn := weather.MMtoIn(day.PrecipitationMM)
	windMph := weather.MsToMph(day.WindSpeedMaxMs)
	gustsMph := weather.MsToMph(day.WindGustsMaxMs)
	et0In := weather.MMtoIn(day.ET0MM)

	var dpMaxF, dpMinF, dpMeanF *float64
	if day.DewPointMaxC != nil {
		v := weather.CtoF(*day.DewPointMaxC)
		dpMaxF = &v
	}
	if day.DewPointMinC != nil {
		v := weather.CtoF(*day.DewPointMinC)
		dpMinF = &v
	}
	if day.DewPointMeanC != nil {
		v := weather.CtoF(*day.DewPointMeanC)
		dpMeanF = &v
	}

	var sunH *float64
	if day.SunshineDurationS != nil {
		v := *day.SunshineDurationS / 3600.0
		sunH = &v
	}

	// If inserting historical, delete any existing forecast for this date
	if weatherType == model.WeatherHistorical {
		_, _ = db.Exec(
			"DELETE FROM daily_weather WHERE date = $1 AND location_id = $2 AND type = 'forecast'",
			day.Date, locationID,
		)
	}

	_, err := db.Exec(`
		INSERT INTO daily_weather (date, location_id, type,
			temperature_max_c, temperature_max_f, temperature_min_c, temperature_min_f,
			precipitation_mm, precipitation_in, precipitation_probability_max,
			wind_speed_max_ms, wind_speed_max_mph, wind_gusts_max_ms, wind_gusts_max_mph, wind_direction_dominant_deg,
			et0_evapotranspiration_mm, et0_evapotranspiration_in,
			relative_humidity_mean, relative_humidity_max, relative_humidity_min,
			dew_point_max_c, dew_point_max_f, dew_point_min_c, dew_point_min_f, dew_point_mean_c, dew_point_mean_f,
			sunshine_duration_s, sunshine_duration_h)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
		ON CONFLICT (date, location_id, type) DO UPDATE SET
			temperature_max_c=EXCLUDED.temperature_max_c, temperature_max_f=EXCLUDED.temperature_max_f,
			temperature_min_c=EXCLUDED.temperature_min_c, temperature_min_f=EXCLUDED.temperature_min_f,
			precipitation_mm=EXCLUDED.precipitation_mm, precipitation_in=EXCLUDED.precipitation_in,
			precipitation_probability_max=EXCLUDED.precipitation_probability_max,
			wind_speed_max_ms=EXCLUDED.wind_speed_max_ms, wind_speed_max_mph=EXCLUDED.wind_speed_max_mph,
			wind_gusts_max_ms=EXCLUDED.wind_gusts_max_ms, wind_gusts_max_mph=EXCLUDED.wind_gusts_max_mph,
			wind_direction_dominant_deg=EXCLUDED.wind_direction_dominant_deg,
			et0_evapotranspiration_mm=EXCLUDED.et0_evapotranspiration_mm, et0_evapotranspiration_in=EXCLUDED.et0_evapotranspiration_in,
			relative_humidity_mean=EXCLUDED.relative_humidity_mean, relative_humidity_max=EXCLUDED.relative_humidity_max,
			relative_humidity_min=EXCLUDED.relative_humidity_min,
			dew_point_max_c=EXCLUDED.dew_point_max_c, dew_point_max_f=EXCLUDED.dew_point_max_f,
			dew_point_min_c=EXCLUDED.dew_point_min_c, dew_point_min_f=EXCLUDED.dew_point_min_f,
			dew_point_mean_c=EXCLUDED.dew_point_mean_c, dew_point_mean_f=EXCLUDED.dew_point_mean_f,
			sunshine_duration_s=EXCLUDED.sunshine_duration_s, sunshine_duration_h=EXCLUDED.sunshine_duration_h`,
		day.Date, locationID, weatherType,
		day.TemperatureMaxC, tmaxF, day.TemperatureMinC, tminF,
		day.PrecipitationMM, precipIn, day.PrecipitationProbability,
		day.WindSpeedMaxMs, windMph, day.WindGustsMaxMs, gustsMph, day.WindDirectionDeg,
		day.ET0MM, et0In,
		day.RelativeHumidityMean, day.RelativeHumidityMax, day.RelativeHumidityMin,
		day.DewPointMaxC, dpMaxF, day.DewPointMinC, dpMinF, day.DewPointMeanC, dpMeanF,
		day.SunshineDurationS, sunH,
	)
	return err
}

func GetWeatherForLocation(db *sql.DB, locationID int, start, end *time.Time) ([]model.DailyWeather, error) {
	query := `SELECT id, date, location_id, type,
		temperature_max_c, temperature_max_f, temperature_min_c, temperature_min_f,
		precipitation_mm, precipitation_in, precipitation_probability_max,
		wind_speed_max_ms, wind_speed_max_mph, wind_gusts_max_ms, wind_gusts_max_mph, wind_direction_dominant_deg,
		et0_evapotranspiration_mm, et0_evapotranspiration_in,
		relative_humidity_mean, relative_humidity_max, relative_humidity_min,
		dew_point_max_c, dew_point_max_f, dew_point_min_c, dew_point_min_f, dew_point_mean_c, dew_point_mean_f,
		sunshine_duration_s, sunshine_duration_h
		FROM daily_weather WHERE location_id = $1`
	args := []interface{}{locationID}
	idx := 2
	if start != nil {
		query += fmt.Sprintf(" AND date >= $%d", idx)
		args = append(args, *start)
		idx++
	}
	if end != nil {
		query += fmt.Sprintf(" AND date <= $%d", idx)
		args = append(args, *end)
	}
	query += " ORDER BY date, type"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close() //nolint:errcheck

	var results []model.DailyWeather
	for rows.Next() {
		var w model.DailyWeather
		if err := rows.Scan(&w.ID, &w.Date, &w.LocationID, &w.Type,
			&w.TemperatureMaxC, &w.TemperatureMaxF, &w.TemperatureMinC, &w.TemperatureMinF,
			&w.PrecipitationMM, &w.PrecipitationIn, &w.PrecipitationProbabilityMax,
			&w.WindSpeedMaxMs, &w.WindSpeedMaxMph, &w.WindGustsMaxMs, &w.WindGustsMaxMph, &w.WindDirectionDeg,
			&w.ET0MM, &w.ET0In,
			&w.RelativeHumidityMean, &w.RelativeHumidityMax, &w.RelativeHumidityMin,
			&w.DewPointMaxC, &w.DewPointMaxF, &w.DewPointMinC, &w.DewPointMinF, &w.DewPointMeanC, &w.DewPointMeanF,
			&w.SunshineDurationS, &w.SunshineDurationH); err != nil {
			return nil, err
		}
		results = append(results, w)
	}
	return results, rows.Err()
}

// --- GDD Models ---

func ListGDDModels(db *sql.DB, locationID *int) ([]model.GDDModel, error) {
	query := "SELECT id, location_id, name, base_temp, unit, start_date, threshold, reset_on_threshold, created_at, updated_at FROM gdd_models"
	var args []interface{}
	if locationID != nil {
		query += " WHERE location_id = $1"
		args = append(args, *locationID)
	}
	query += " ORDER BY name"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close() //nolint:errcheck

	var models []model.GDDModel
	for rows.Next() {
		var m model.GDDModel
		if err := rows.Scan(&m.ID, &m.LocationID, &m.Name, &m.BaseTemp, &m.Unit, &m.StartDate,
			&m.Threshold, &m.ResetOnThreshold, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		models = append(models, m)
	}
	return models, rows.Err()
}

func CreateGDDModel(db *sql.DB, m *model.GDDModel) (*model.GDDModel, error) {
	err := db.QueryRow(`
		INSERT INTO gdd_models (location_id, name, base_temp, unit, start_date, threshold, reset_on_threshold)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id, created_at, updated_at`,
		m.LocationID, m.Name, m.BaseTemp, m.Unit, m.StartDate, m.Threshold, m.ResetOnThreshold,
	).Scan(&m.ID, &m.CreatedAt, &m.UpdatedAt)
	return m, err
}

func DeleteGDDModel(db *sql.DB, id int) error {
	_, err := db.Exec("DELETE FROM gdd_models WHERE id = $1", id)
	return err
}

func GetGDDValues(db *sql.DB, modelID int) ([]model.GDDValue, error) {
	rows, err := db.Query(
		"SELECT id, gdd_model_id, date, daily_gdd, cumulative_gdd, is_forecast, run FROM gdd_values WHERE gdd_model_id = $1 ORDER BY date",
		modelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close() //nolint:errcheck

	var values []model.GDDValue
	for rows.Next() {
		var v model.GDDValue
		if err := rows.Scan(&v.ID, &v.GDDModelID, &v.Date, &v.DailyGDD, &v.CumulativeGDD, &v.IsForecast, &v.Run); err != nil {
			return nil, err
		}
		values = append(values, v)
	}
	return values, rows.Err()
}

func UpsertGDDValues(db *sql.DB, modelID int, values []struct {
	Date          time.Time
	DailyGDD      float64
	CumulativeGDD float64
	IsForecast    bool
	Run           int
}) error {
	if len(values) == 0 {
		return nil
	}

	// Delete existing values for this model and rewrite
	_, err := db.Exec("DELETE FROM gdd_values WHERE gdd_model_id = $1", modelID)
	if err != nil {
		return err
	}

	// Batch insert
	var b strings.Builder
	b.WriteString("INSERT INTO gdd_values (gdd_model_id, date, daily_gdd, cumulative_gdd, is_forecast, run) VALUES ")
	args := make([]interface{}, 0, len(values)*6)
	for i, v := range values {
		if i > 0 {
			b.WriteString(",")
		}
		base := i*6 + 1
		fmt.Fprintf(&b, "($%d,$%d,$%d,$%d,$%d,$%d)", base, base+1, base+2, base+3, base+4, base+5)
		args = append(args, modelID, v.Date, v.DailyGDD, v.CumulativeGDD, v.IsForecast, v.Run)
	}

	_, err = db.Exec(b.String(), args...)
	return err
}

// --- Disease Pressure ---

func GetDiseasePressure(db *sql.DB, locationID int, start, end *time.Time) ([]model.DiseasePressure, error) {
	query := "SELECT id, date, location_id, disease, risk_score, created_at FROM disease_pressure WHERE location_id = $1"
	args := []interface{}{locationID}
	idx := 2
	if start != nil {
		query += fmt.Sprintf(" AND date >= $%d", idx)
		args = append(args, *start)
		idx++
	}
	if end != nil {
		query += fmt.Sprintf(" AND date <= $%d", idx)
		args = append(args, *end)
	}
	query += " ORDER BY date"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close() //nolint:errcheck

	var results []model.DiseasePressure
	for rows.Next() {
		var d model.DiseasePressure
		if err := rows.Scan(&d.ID, &d.Date, &d.LocationID, &d.Disease, &d.RiskScore, &d.CreatedAt); err != nil {
			return nil, err
		}
		results = append(results, d)
	}
	return results, rows.Err()
}

// --- Growth Potential ---

func GetGrowthPotential(db *sql.DB, locationID int, start, end *time.Time) ([]model.GrowthPotential, error) {
	query := `SELECT id, date, location_id, growth_potential, gp_3d_avg, gp_5d_avg, gp_7d_avg, created_at
		FROM growth_potential WHERE location_id = $1`
	args := []interface{}{locationID}
	idx := 2
	if start != nil {
		query += fmt.Sprintf(" AND date >= $%d", idx)
		args = append(args, *start)
		idx++
	}
	if end != nil {
		query += fmt.Sprintf(" AND date <= $%d", idx)
		args = append(args, *end)
	}
	query += " ORDER BY date"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close() //nolint:errcheck

	var results []model.GrowthPotential
	for rows.Next() {
		var g model.GrowthPotential
		if err := rows.Scan(&g.ID, &g.Date, &g.LocationID, &g.GrowthPotential,
			&g.GP3dAvg, &g.GP5dAvg, &g.GP7dAvg, &g.CreatedAt); err != nil {
			return nil, err
		}
		results = append(results, g)
	}
	return results, rows.Err()
}

// --- Water Management ---

func GetWeeklyWaterSummaries(db *sql.DB, lawnID int) ([]model.WeeklyWaterSummary, error) {
	rows, err := db.Query(`
		SELECT id, lawn_id, week_start, week_end, et0_total, precipitation_total,
		       irrigation_applied, water_deficit, status, is_forecast, created_at, updated_at
		FROM weekly_water_summaries WHERE lawn_id = $1 ORDER BY week_start DESC`, lawnID)
	if err != nil {
		return nil, err
	}
	defer rows.Close() //nolint:errcheck

	var results []model.WeeklyWaterSummary
	for rows.Next() {
		var w model.WeeklyWaterSummary
		if err := rows.Scan(&w.ID, &w.LawnID, &w.WeekStart, &w.WeekEnd, &w.ET0Total, &w.PrecipitationTotal,
			&w.IrrigationApplied, &w.WaterDeficit, &w.Status, &w.IsForecast, &w.CreatedAt, &w.UpdatedAt); err != nil {
			return nil, err
		}
		results = append(results, w)
	}
	return results, rows.Err()
}

func ListIrrigationEntries(db *sql.DB, lawnID int, start, end *time.Time) ([]model.IrrigationEntry, error) {
	query := "SELECT id, lawn_id, date, amount, duration, source, notes, created_at, updated_at FROM irrigation_entries WHERE lawn_id = $1"
	args := []interface{}{lawnID}
	idx := 2
	if start != nil {
		query += fmt.Sprintf(" AND date >= $%d", idx)
		args = append(args, *start)
		idx++
	}
	if end != nil {
		query += fmt.Sprintf(" AND date <= $%d", idx)
		args = append(args, *end)
	}
	query += " ORDER BY date DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close() //nolint:errcheck

	var results []model.IrrigationEntry
	for rows.Next() {
		var e model.IrrigationEntry
		if err := rows.Scan(&e.ID, &e.LawnID, &e.Date, &e.Amount, &e.Duration, &e.Source, &e.Notes,
			&e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		results = append(results, e)
	}
	return results, rows.Err()
}

func CreateIrrigationEntry(db *sql.DB, e *model.IrrigationEntry) (*model.IrrigationEntry, error) {
	err := db.QueryRow(`
		INSERT INTO irrigation_entries (lawn_id, date, amount, duration, source, notes)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id, created_at, updated_at`,
		e.LawnID, e.Date, e.Amount, e.Duration, e.Source, e.Notes,
	).Scan(&e.ID, &e.CreatedAt, &e.UpdatedAt)
	return e, err
}

func DeleteIrrigationEntry(db *sql.DB, id int) error {
	_, err := db.Exec("DELETE FROM irrigation_entries WHERE id = $1", id)
	return err
}

// --- Weed Pressure ---

func GetWeedPressure(db *sql.DB, locationID int, start, end *time.Time) ([]model.WeedPressure, error) {
	query := `SELECT wp.id, wp.location_id, wp.date, wp.weed_species_id,
		wp.weed_pressure_score, wp.gdd_risk_score, wp.soil_temp_risk_score,
		wp.moisture_risk_score, wp.turf_stress_score, wp.seasonal_timing_score,
		wp.gdd_accumulated, wp.soil_temp_estimate_c, wp.precipitation_3day_mm,
		wp.humidity_avg, wp.et0_mm, wp.is_forecast, wp.created_at,
		ws.id, ws.name, ws.common_name
		FROM weed_pressure wp
		JOIN weed_species ws ON wp.weed_species_id = ws.id
		WHERE wp.location_id = $1`
	args := []interface{}{locationID}
	idx := 2
	if start != nil {
		query += fmt.Sprintf(" AND wp.date >= $%d", idx)
		args = append(args, *start)
		idx++
	}
	if end != nil {
		query += fmt.Sprintf(" AND wp.date <= $%d", idx)
		args = append(args, *end)
	}
	query += " ORDER BY wp.date, ws.common_name"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close() //nolint:errcheck

	var results []model.WeedPressure
	for rows.Next() {
		var w model.WeedPressure
		var ws model.WeedSpecies
		if err := rows.Scan(&w.ID, &w.LocationID, &w.Date, &w.WeedSpeciesID,
			&w.WeedPressureScore, &w.GDDRiskScore, &w.SoilTempRiskScore,
			&w.MoistureRiskScore, &w.TurfStressScore, &w.SeasonalTimingScore,
			&w.GDDAccumulated, &w.SoilTempEstimateC, &w.Precipitation3DayMM,
			&w.HumidityAvg, &w.ET0MM, &w.IsForecast, &w.CreatedAt,
			&ws.ID, &ws.Name, &ws.CommonName); err != nil {
			return nil, err
		}
		w.WeedSpeciesObj = &ws
		results = append(results, w)
	}
	return results, rows.Err()
}

func ListWeedSpecies(db *sql.DB, activeOnly bool) ([]model.WeedSpecies, error) {
	query := `SELECT id, name, common_name, gdd_base_temp_c, gdd_threshold_emergence,
		optimal_soil_temp_min_c, optimal_soil_temp_max_c, moisture_preference, season,
		is_active, created_at, updated_at FROM weed_species`
	if activeOnly {
		query += " WHERE is_active = true"
	}
	query += " ORDER BY common_name"

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close() //nolint:errcheck

	var results []model.WeedSpecies
	for rows.Next() {
		var w model.WeedSpecies
		if err := rows.Scan(&w.ID, &w.Name, &w.CommonName, &w.GDDBaseTempC, &w.GDDThresholdEmergence,
			&w.OptimalSoilTempMinC, &w.OptimalSoilTempMaxC, &w.MoisturePreference, &w.Season,
			&w.IsActive, &w.CreatedAt, &w.UpdatedAt); err != nil {
			return nil, err
		}
		results = append(results, w)
	}
	return results, rows.Err()
}

// --- Task Status ---

func ListTaskStatuses(db *sql.DB, limit int) ([]model.TaskStatus, error) {
	rows, err := db.Query(`
		SELECT id, task_id, task_name, related_location_id, related_lawn_id, status,
		       created_at, started_at, finished_at, result, error, request_id
		FROM task_status ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close() //nolint:errcheck

	var results []model.TaskStatus
	for rows.Next() {
		var t model.TaskStatus
		if err := rows.Scan(&t.ID, &t.TaskID, &t.TaskName, &t.RelatedLocationID, &t.RelatedLawnID,
			&t.Status, &t.CreatedAt, &t.StartedAt, &t.FinishedAt, &t.Result, &t.Error, &t.RequestID); err != nil {
			return nil, err
		}
		results = append(results, t)
	}
	return results, rows.Err()
}

func CreateTaskStatus(db *sql.DB, taskID, taskName string, locationID *int) error {
	_, err := db.Exec(`
		INSERT INTO task_status (task_id, task_name, related_location_id, status)
		VALUES ($1, $2, $3, 'started')`,
		taskID, taskName, locationID)
	return err
}

func UpdateTaskStatus(db *sql.DB, taskID string, status model.TaskStatusEnum, result, errMsg *string) error {
	_, err := db.Exec(`
		UPDATE task_status SET status=$1, result=$2, error=$3, finished_at=NOW()
		WHERE task_id=$4`,
		status, result, errMsg, taskID)
	return err
}

// --- App Settings ---

func GetSetting(db *sql.DB, key string) (string, error) {
	var val string
	err := db.QueryRow("SELECT value FROM app_settings WHERE key = $1", key).Scan(&val)
	return val, err
}

func SetSetting(db *sql.DB, key, value string) error {
	_, err := db.Exec(`
		INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
		ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
		key, value)
	return err
}

func GetAllSettings(db *sql.DB) (map[string]string, error) {
	rows, err := db.Query("SELECT key, value FROM app_settings ORDER BY key")
	if err != nil {
		return nil, err
	}
	defer rows.Close() //nolint:errcheck

	settings := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		settings[k] = v
	}
	return settings, rows.Err()
}

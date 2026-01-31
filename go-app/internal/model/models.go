// Package model defines all database entity types for TurfTrack.
package model

import (
	"database/sql"
	"time"
)

// Enums

type GrassType string

const (
	GrassTypeCold GrassType = "cold_season"
	GrassTypeWarm GrassType = "warm_season"
)

type WeatherType string

const (
	WeatherHistorical WeatherType = "historical"
	WeatherForecast   WeatherType = "forecast"
)

type TempUnit string

const (
	TempUnitC TempUnit = "C"
	TempUnitF TempUnit = "F"
)

type ResetType string

const (
	ResetManual      ResetType = "manual"
	ResetThreshold   ResetType = "threshold"
	ResetInitial     ResetType = "initial"
	ResetApplication ResetType = "application"
)

type TaskStatusEnum string

const (
	TaskPending TaskStatusEnum = "pending"
	TaskStarted TaskStatusEnum = "started"
	TaskSuccess TaskStatusEnum = "success"
	TaskFailure TaskStatusEnum = "failure"
)

type ApplicationStatus string

const (
	AppPlanned   ApplicationStatus = "planned"
	AppCompleted ApplicationStatus = "completed"
	AppSkipped   ApplicationStatus = "skipped"
)

type ApplicationUnit string

const (
	UnitLbs     ApplicationUnit = "lbs"
	UnitOz      ApplicationUnit = "oz"
	UnitKg      ApplicationUnit = "kg"
	UnitG       ApplicationUnit = "g"
	UnitGal     ApplicationUnit = "gal"
	UnitQt      ApplicationUnit = "qt"
	UnitPt      ApplicationUnit = "pt"
	UnitFlOz    ApplicationUnit = "fl_oz"
	UnitL       ApplicationUnit = "L"
	UnitML      ApplicationUnit = "mL"
	UnitBags    ApplicationUnit = "bags"
	UnitTablets ApplicationUnit = "tablets"
)

type IrrigationSource string

const (
	IrrigationManual    IrrigationSource = "MANUAL"
	IrrigationAutomatic IrrigationSource = "AUTOMATIC"
	IrrigationScheduled IrrigationSource = "SCHEDULED"
)

type WeedSeason string

const (
	SeasonSpring    WeedSeason = "spring"
	SeasonSummer    WeedSeason = "summer"
	SeasonFall      WeedSeason = "fall"
	SeasonYearRound WeedSeason = "year_round"
)

type MoisturePreference string

const (
	MoistureLow    MoisturePreference = "low"
	MoistureMedium MoisturePreference = "medium"
	MoistureHigh   MoisturePreference = "high"
)

// Core Entities

type Location struct {
	ID        int     `json:"id" db:"id"`
	Name      string  `json:"name" db:"name"`
	Latitude  float64 `json:"latitude" db:"latitude"`
	Longitude float64 `json:"longitude" db:"longitude"`
}

type Lawn struct {
	ID             int            `json:"id" db:"id"`
	Name           string         `json:"name" db:"name"`
	Area           float64        `json:"area" db:"area"`
	GrassType      GrassType      `json:"grass_type" db:"grass_type"`
	Notes          sql.NullString `json:"notes" db:"notes"`
	WeatherEnabled bool           `json:"weather_enabled" db:"weather_enabled"`
	LocationID     int            `json:"location_id" db:"location_id"`
	CreatedAt      time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at" db:"updated_at"`

	// Joined
	Location *Location `json:"location,omitempty" db:"-"`
}

type DailyWeather struct {
	ID         int         `json:"id" db:"id"`
	Date       time.Time   `json:"date" db:"date"`
	LocationID int         `json:"location_id" db:"location_id"`
	Type       WeatherType `json:"type" db:"type"`

	TemperatureMaxC float64 `json:"temperature_max_c" db:"temperature_max_c"`
	TemperatureMaxF float64 `json:"temperature_max_f" db:"temperature_max_f"`
	TemperatureMinC float64 `json:"temperature_min_c" db:"temperature_min_c"`
	TemperatureMinF float64 `json:"temperature_min_f" db:"temperature_min_f"`

	PrecipitationMM             float64 `json:"precipitation_mm" db:"precipitation_mm"`
	PrecipitationIn             float64 `json:"precipitation_in" db:"precipitation_in"`
	PrecipitationProbabilityMax float64 `json:"precipitation_probability_max" db:"precipitation_probability_max"`

	WindSpeedMaxMs     float64 `json:"wind_speed_max_ms" db:"wind_speed_max_ms"`
	WindSpeedMaxMph    float64 `json:"wind_speed_max_mph" db:"wind_speed_max_mph"`
	WindGustsMaxMs     float64 `json:"wind_gusts_max_ms" db:"wind_gusts_max_ms"`
	WindGustsMaxMph    float64 `json:"wind_gusts_max_mph" db:"wind_gusts_max_mph"`
	WindDirectionDeg   float64 `json:"wind_direction_dominant_deg" db:"wind_direction_dominant_deg"`

	ET0MM float64 `json:"et0_evapotranspiration_mm" db:"et0_evapotranspiration_mm"`
	ET0In float64 `json:"et0_evapotranspiration_in" db:"et0_evapotranspiration_in"`

	RelativeHumidityMean *float64 `json:"relative_humidity_mean" db:"relative_humidity_mean"`
	RelativeHumidityMax  *float64 `json:"relative_humidity_max" db:"relative_humidity_max"`
	RelativeHumidityMin  *float64 `json:"relative_humidity_min" db:"relative_humidity_min"`

	DewPointMaxC  *float64 `json:"dew_point_max_c" db:"dew_point_max_c"`
	DewPointMaxF  *float64 `json:"dew_point_max_f" db:"dew_point_max_f"`
	DewPointMinC  *float64 `json:"dew_point_min_c" db:"dew_point_min_c"`
	DewPointMinF  *float64 `json:"dew_point_min_f" db:"dew_point_min_f"`
	DewPointMeanC *float64 `json:"dew_point_mean_c" db:"dew_point_mean_c"`
	DewPointMeanF *float64 `json:"dew_point_mean_f" db:"dew_point_mean_f"`

	SunshineDurationS *float64 `json:"sunshine_duration_s" db:"sunshine_duration_s"`
	SunshineDurationH *float64 `json:"sunshine_duration_h" db:"sunshine_duration_h"`
}

// GDD Models

type GDDModel struct {
	ID               int       `json:"id" db:"id"`
	LocationID       int       `json:"location_id" db:"location_id"`
	Name             string    `json:"name" db:"name"`
	BaseTemp         float64   `json:"base_temp" db:"base_temp"`
	Unit             TempUnit  `json:"unit" db:"unit"`
	StartDate        time.Time `json:"start_date" db:"start_date"`
	Threshold        float64   `json:"threshold" db:"threshold"`
	ResetOnThreshold bool      `json:"reset_on_threshold" db:"reset_on_threshold"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`

	// Joined
	Location *Location  `json:"location,omitempty" db:"-"`
	Values   []GDDValue `json:"gdd_values,omitempty" db:"-"`
	Resets   []GDDReset `json:"resets,omitempty" db:"-"`
}

type GDDModelParameters struct {
	ID               int       `json:"id" db:"id"`
	GDDModelID       int       `json:"gdd_model_id" db:"gdd_model_id"`
	BaseTemp         float64   `json:"base_temp" db:"base_temp"`
	Threshold        float64   `json:"threshold" db:"threshold"`
	ResetOnThreshold bool      `json:"reset_on_threshold" db:"reset_on_threshold"`
	EffectiveFrom    time.Time `json:"effective_from" db:"effective_from"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
}

type GDDValue struct {
	ID            int       `json:"id" db:"id"`
	GDDModelID    int       `json:"gdd_model_id" db:"gdd_model_id"`
	Date          time.Time `json:"date" db:"date"`
	DailyGDD      float64   `json:"daily_gdd" db:"daily_gdd"`
	CumulativeGDD float64   `json:"cumulative_gdd" db:"cumulative_gdd"`
	IsForecast    bool      `json:"is_forecast" db:"is_forecast"`
	Run           int       `json:"run" db:"run"`
}

type GDDReset struct {
	ID         int       `json:"id" db:"id"`
	GDDModelID int       `json:"gdd_model_id" db:"gdd_model_id"`
	ResetDate  time.Time `json:"reset_date" db:"reset_date"`
	RunNumber  int       `json:"run_number" db:"run_number"`
	ResetType  ResetType `json:"reset_type" db:"reset_type"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

// Product & Application

type Product struct {
	ID   int    `json:"id" db:"id"`
	Name string `json:"name" db:"name"`

	NPct  float64 `json:"n_pct" db:"n_pct"`
	PPct  float64 `json:"p_pct" db:"p_pct"`
	KPct  float64 `json:"k_pct" db:"k_pct"`
	CaPct float64 `json:"ca_pct" db:"ca_pct"`
	MgPct float64 `json:"mg_pct" db:"mg_pct"`
	SPct  float64 `json:"s_pct" db:"s_pct"`
	FePct float64 `json:"fe_pct" db:"fe_pct"`
	CuPct float64 `json:"cu_pct" db:"cu_pct"`
	MnPct float64 `json:"mn_pct" db:"mn_pct"`
	BPct  float64 `json:"b_pct" db:"b_pct"`
	ZnPct float64 `json:"zn_pct" db:"zn_pct"`

	WeightLbs  *float64 `json:"weight_lbs" db:"weight_lbs"`
	CostPerBag *float64 `json:"cost_per_bag" db:"cost_per_bag"`

	SGN         *string `json:"sgn" db:"sgn"`
	ProductLink *string `json:"product_link" db:"product_link"`
	Label       *string `json:"label" db:"label"`
	Sources     *string `json:"sources" db:"sources"`

	UreaNitrogen       *float64 `json:"urea_nitrogen" db:"urea_nitrogen"`
	AmmoniacalNitrogen *float64 `json:"ammoniacal_nitrogen" db:"ammoniacal_nitrogen"`
	WaterInsolNitrogen *float64 `json:"water_insol_nitrogen" db:"water_insol_nitrogen"`
	OtherWaterSoluble  *float64 `json:"other_water_soluble" db:"other_water_soluble"`
	SlowlyAvailFrom    *string  `json:"slowly_available_from" db:"slowly_available_from"`

	CostPerLbN *float64 `json:"cost_per_lb_n" db:"cost_per_lb_n"`
	CostPerLb  *float64 `json:"cost_per_lb" db:"cost_per_lb"`

	LastScrapedPrice *float64   `json:"last_scraped_price" db:"last_scraped_price"`
	LastScrapedAt    *time.Time `json:"last_scraped_at" db:"last_scraped_at"`

	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type Application struct {
	ID              int               `json:"id" db:"id"`
	LawnID          int               `json:"lawn_id" db:"lawn_id"`
	ProductID       int               `json:"product_id" db:"product_id"`
	ApplicationDate time.Time         `json:"application_date" db:"application_date"`
	AmountPerArea   float64           `json:"amount_per_area" db:"amount_per_area"`
	AreaUnit        int               `json:"area_unit" db:"area_unit"`
	Unit            ApplicationUnit   `json:"unit" db:"unit"`
	Notes           sql.NullString    `json:"notes" db:"notes"`
	Status          ApplicationStatus `json:"status" db:"status"`
	TiedGDDModelID  *int              `json:"tied_gdd_model_id" db:"tied_gdd_model_id"`

	CostApplied *float64 `json:"cost_applied" db:"cost_applied"`
	NApplied    *float64 `json:"n_applied" db:"n_applied"`
	PApplied    *float64 `json:"p_applied" db:"p_applied"`
	KApplied    *float64 `json:"k_applied" db:"k_applied"`
	CaApplied   *float64 `json:"ca_applied" db:"ca_applied"`
	MgApplied   *float64 `json:"mg_applied" db:"mg_applied"`
	SApplied    *float64 `json:"s_applied" db:"s_applied"`
	FeApplied   *float64 `json:"fe_applied" db:"fe_applied"`
	CuApplied   *float64 `json:"cu_applied" db:"cu_applied"`
	MnApplied   *float64 `json:"mn_applied" db:"mn_applied"`
	BApplied    *float64 `json:"b_applied" db:"b_applied"`
	ZnApplied   *float64 `json:"zn_applied" db:"zn_applied"`

	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`

	// Joined
	Lawn    *Lawn    `json:"lawn,omitempty" db:"-"`
	Product *Product `json:"product,omitempty" db:"-"`
}

// Disease Pressure

type DiseasePressure struct {
	ID         int       `json:"id" db:"id"`
	Date       time.Time `json:"date" db:"date"`
	LocationID int       `json:"location_id" db:"location_id"`
	Disease    string    `json:"disease" db:"disease"`
	RiskScore  *float64  `json:"risk_score" db:"risk_score"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	IsForecast bool      `json:"is_forecast" db:"-"`
}

// Growth Potential

type GrowthPotential struct {
	ID              int       `json:"id" db:"id"`
	Date            time.Time `json:"date" db:"date"`
	LocationID      int       `json:"location_id" db:"location_id"`
	GrowthPotential *float64  `json:"growth_potential" db:"growth_potential"`
	GP3dAvg         *float64  `json:"gp_3d_avg" db:"gp_3d_avg"`
	GP5dAvg         *float64  `json:"gp_5d_avg" db:"gp_5d_avg"`
	GP7dAvg         *float64  `json:"gp_7d_avg" db:"gp_7d_avg"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	IsForecast      bool      `json:"is_forecast" db:"-"`
}

// Water Management

type IrrigationEntry struct {
	ID        int              `json:"id" db:"id"`
	LawnID    int              `json:"lawn_id" db:"lawn_id"`
	Date      time.Time        `json:"date" db:"date"`
	Amount    float64          `json:"amount" db:"amount"`
	Duration  int              `json:"duration" db:"duration"`
	Source    IrrigationSource `json:"source" db:"source"`
	Notes     sql.NullString   `json:"notes" db:"notes"`
	CreatedAt time.Time        `json:"created_at" db:"created_at"`
	UpdatedAt time.Time        `json:"updated_at" db:"updated_at"`
}

type WeeklyWaterSummary struct {
	ID                 int       `json:"id" db:"id"`
	LawnID             int       `json:"lawn_id" db:"lawn_id"`
	WeekStart          time.Time `json:"week_start" db:"week_start"`
	WeekEnd            time.Time `json:"week_end" db:"week_end"`
	ET0Total           float64   `json:"et0_total" db:"et0_total"`
	PrecipitationTotal float64   `json:"precipitation_total" db:"precipitation_total"`
	IrrigationApplied  float64   `json:"irrigation_applied" db:"irrigation_applied"`
	WaterDeficit       float64   `json:"water_deficit" db:"water_deficit"`
	Status             string    `json:"status" db:"status"`
	IsForecast         bool      `json:"is_forecast" db:"is_forecast"`
	CreatedAt          time.Time `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time `json:"updated_at" db:"updated_at"`
}

// Weed Pressure

type WeedSpecies struct {
	ID                    int                `json:"id" db:"id"`
	Name                  string             `json:"name" db:"name"`
	CommonName            string             `json:"common_name" db:"common_name"`
	GDDBaseTempC          float64            `json:"gdd_base_temp_c" db:"gdd_base_temp_c"`
	GDDThresholdEmergence float64            `json:"gdd_threshold_emergence" db:"gdd_threshold_emergence"`
	OptimalSoilTempMinC   float64            `json:"optimal_soil_temp_min_c" db:"optimal_soil_temp_min_c"`
	OptimalSoilTempMaxC   float64            `json:"optimal_soil_temp_max_c" db:"optimal_soil_temp_max_c"`
	MoisturePreference    MoisturePreference `json:"moisture_preference" db:"moisture_preference"`
	Season                WeedSeason         `json:"season" db:"season"`
	IsActive              bool               `json:"is_active" db:"is_active"`
	CreatedAt             time.Time          `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time          `json:"updated_at" db:"updated_at"`
}

type WeedPressure struct {
	ID                 int       `json:"id" db:"id"`
	LocationID         int       `json:"location_id" db:"location_id"`
	Date               time.Time `json:"date" db:"date"`
	WeedSpeciesID      int       `json:"weed_species_id" db:"weed_species_id"`
	WeedPressureScore  float64   `json:"weed_pressure_score" db:"weed_pressure_score"`
	GDDRiskScore       float64   `json:"gdd_risk_score" db:"gdd_risk_score"`
	SoilTempRiskScore  float64   `json:"soil_temp_risk_score" db:"soil_temp_risk_score"`
	MoistureRiskScore  float64   `json:"moisture_risk_score" db:"moisture_risk_score"`
	TurfStressScore    float64   `json:"turf_stress_score" db:"turf_stress_score"`
	SeasonalTimingScore float64  `json:"seasonal_timing_score" db:"seasonal_timing_score"`
	GDDAccumulated     float64   `json:"gdd_accumulated" db:"gdd_accumulated"`
	SoilTempEstimateC  float64   `json:"soil_temp_estimate_c" db:"soil_temp_estimate_c"`
	Precipitation3DayMM float64  `json:"precipitation_3day_mm" db:"precipitation_3day_mm"`
	HumidityAvg        float64   `json:"humidity_avg" db:"humidity_avg"`
	ET0MM              float64   `json:"et0_mm" db:"et0_mm"`
	IsForecast         bool      `json:"is_forecast" db:"is_forecast"`
	CreatedAt          time.Time `json:"created_at" db:"created_at"`

	// Joined
	WeedSpeciesObj *WeedSpecies `json:"weed_species,omitempty" db:"-"`
}

// Task Status

type TaskStatus struct {
	ID                int            `json:"id" db:"id"`
	TaskID            string         `json:"task_id" db:"task_id"`
	TaskName          string         `json:"task_name" db:"task_name"`
	RelatedLocationID *int           `json:"related_location_id" db:"related_location_id"`
	RelatedLawnID     *int           `json:"related_lawn_id" db:"related_lawn_id"`
	Status            TaskStatusEnum `json:"status" db:"status"`
	CreatedAt         time.Time      `json:"created_at" db:"created_at"`
	StartedAt         *time.Time     `json:"started_at" db:"started_at"`
	FinishedAt        *time.Time     `json:"finished_at" db:"finished_at"`
	Result            sql.NullString `json:"result" db:"result"`
	Error             sql.NullString `json:"error" db:"error"`
	RequestID         sql.NullString `json:"request_id" db:"request_id"`
}

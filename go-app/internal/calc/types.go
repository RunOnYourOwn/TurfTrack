package calc

// GrassTypeCalc represents grass type for calculations.
type GrassTypeCalc string

const (
	GrassTypeCold GrassTypeCalc = "cold_season"
	GrassTypeWarm GrassTypeCalc = "warm_season"
)

// WeedSeasonType for seasonal timing calculations.
type WeedSeasonType string

const (
	SeasonSpringCalc    WeedSeasonType = "spring"
	SeasonSummerCalc    WeedSeasonType = "summer"
	SeasonFallCalc      WeedSeasonType = "fall"
	SeasonYearRoundCalc WeedSeasonType = "year_round"
)

// WeatherDay holds the temperature data needed for GDD calculation.
type WeatherDay struct {
	TmaxC float64
	TminC float64
}

// GDDResult holds a single day's GDD calculation result.
type GDDResult struct {
	DailyGDD      float64
	CumulativeGDD float64
	Run           int
}

// DiseaseWeatherDay holds data needed for Smith-Kerns calculation.
type DiseaseWeatherDay struct {
	AvgTempC         float64
	RelativeHumidity float64
}

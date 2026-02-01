// Package weather fetches data from the Open-Meteo API.
package weather

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"time"
)

const baseURL = "https://api.open-meteo.com/v1/forecast"
const defaultArchiveBaseURL = "https://archive-api.open-meteo.com/v1/archive"

// archiveDailyVars is the same as forecast daily vars but without precipitation_probability_max
// (which is not available in the archive API).
const archiveDailyVars = "temperature_2m_max,temperature_2m_min,precipitation_sum," +
	"windspeed_10m_max,windgusts_10m_max," +
	"winddirection_10m_dominant,et0_fao_evapotranspiration," +
	"relative_humidity_2m_mean,relative_humidity_2m_max,relative_humidity_2m_min," +
	"dew_point_2m_max,dew_point_2m_min,dew_point_2m_mean,sunshine_duration"

// maxChunkDays is the maximum number of days per archive API request.
const maxChunkDays = 45

// Client fetches weather data from Open-Meteo.
type Client struct {
	HTTPClient     *http.Client
	BaseURL        string // empty = use default baseURL; settable for testing
	ArchiveBaseURL string // empty = use defaultArchiveBaseURL; settable for testing
}

// NewClient creates a new Open-Meteo client.
func NewClient() *Client {
	return &Client{
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// DailyData holds one day of weather data from Open-Meteo.
type DailyData struct {
	Date                     time.Time
	TemperatureMaxC          float64
	TemperatureMinC          float64
	PrecipitationMM          float64
	PrecipitationProbability float64
	WindSpeedMaxMs           float64
	WindGustsMaxMs           float64
	WindDirectionDeg         float64
	ET0MM                    float64
	RelativeHumidityMean     *float64
	RelativeHumidityMax      *float64
	RelativeHumidityMin      *float64
	DewPointMaxC             *float64
	DewPointMinC             *float64
	DewPointMeanC            *float64
	SunshineDurationS        *float64
}

// openMeteoResponse matches the Open-Meteo API response shape.
type openMeteoResponse struct {
	Daily struct {
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
	} `json:"daily"`
}

// FetchDailyWeather fetches weather data for a location using past_days/forecast_days.
// This makes a single API call that returns both historical and forecast data,
// avoiding boundary issues with start_date/end_date.
func (c *Client) FetchDailyWeather(lat, lon float64, pastDays, forecastDays int) ([]DailyData, error) {
	forecastURL := c.BaseURL
	if forecastURL == "" {
		forecastURL = baseURL
	}
	url := fmt.Sprintf(
		"%s?latitude=%.4f&longitude=%.4f&past_days=%d&forecast_days=%d"+
			"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"+
			"precipitation_probability_max,windspeed_10m_max,windgusts_10m_max,"+
			"winddirection_10m_dominant,et0_fao_evapotranspiration,"+
			"relative_humidity_2m_mean,relative_humidity_2m_max,relative_humidity_2m_min,"+
			"dew_point_2m_max,dew_point_2m_min,dew_point_2m_mean,sunshine_duration"+
			"&timezone=auto",
		forecastURL, lat, lon, pastDays, forecastDays,
	)

	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("open-meteo request failed: %w", err)
	}
	defer resp.Body.Close() //nolint:errcheck

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("open-meteo returned status %d", resp.StatusCode)
	}

	var omResp openMeteoResponse
	if err := json.NewDecoder(resp.Body).Decode(&omResp); err != nil {
		return nil, fmt.Errorf("failed to decode open-meteo response: %w", err)
	}

	return parseDailyData(omResp), nil
}

func parseDailyData(resp openMeteoResponse) []DailyData {
	d := resp.Daily
	n := len(d.Time)
	result := make([]DailyData, 0, n)

	for i := 0; i < n; i++ {
		date, err := time.Parse("2006-01-02", d.Time[i])
		if err != nil {
			continue
		}

		day := DailyData{
			Date:                     date,
			TemperatureMaxC:          sanitize(getFloat(d.Temperature2mMax, i)),
			TemperatureMinC:          sanitize(getFloat(d.Temperature2mMin, i)),
			PrecipitationMM:          sanitize(getFloat(d.PrecipitationSum, i)),
			PrecipitationProbability: sanitize(getFloat(d.PrecipitationProbabilityMax, i)),
			WindSpeedMaxMs:           sanitize(getFloat(d.Windspeed10mMax, i)),
			WindGustsMaxMs:           sanitize(getFloat(d.Windgusts10mMax, i)),
			WindDirectionDeg:         sanitize(getFloat(d.WinddirectionDominant, i)),
			ET0MM:                    sanitize(getFloat(d.ET0Evapotranspiration, i)),
		}

		day.RelativeHumidityMean = sanitizePtr(getFloat(d.RelativeHumidity2mMean, i))
		day.RelativeHumidityMax = sanitizePtr(getFloat(d.RelativeHumidity2mMax, i))
		day.RelativeHumidityMin = sanitizePtr(getFloat(d.RelativeHumidity2mMin, i))
		day.DewPointMaxC = sanitizePtr(getFloat(d.DewPoint2mMax, i))
		day.DewPointMinC = sanitizePtr(getFloat(d.DewPoint2mMin, i))
		day.DewPointMeanC = sanitizePtr(getFloat(d.DewPoint2mMean, i))
		day.SunshineDurationS = sanitizePtr(getFloat(d.SunshineDuration, i))

		result = append(result, day)
	}

	return result
}

func getFloat(slice []float64, i int) float64 {
	if i >= len(slice) {
		return 0
	}
	return slice[i]
}

func sanitize(v float64) float64 {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return 0
	}
	return v
}

func sanitizePtr(v float64) *float64 {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return nil
	}
	return &v
}

// FetchHistoricalWeather fetches weather data from the Open-Meteo Archive API
// for the given date range. Chunks requests into maxChunkDays segments and
// deduplicates results by date. Sleeps 1s between chunks as free-API courtesy.
func (c *Client) FetchHistoricalWeather(lat, lon float64, startDate, endDate time.Time) ([]DailyData, error) {
	archiveURL := c.ArchiveBaseURL
	if archiveURL == "" {
		archiveURL = defaultArchiveBaseURL
	}

	startDate = startDate.Truncate(24 * time.Hour)
	endDate = endDate.Truncate(24 * time.Hour)
	if endDate.Before(startDate) {
		return nil, fmt.Errorf("endDate %s is before startDate %s", endDate.Format("2006-01-02"), startDate.Format("2006-01-02"))
	}

	seen := map[string]bool{}
	var allData []DailyData

	chunkStart := startDate
	first := true
	for !chunkStart.After(endDate) {
		if !first {
			time.Sleep(1 * time.Second)
		}
		first = false

		chunkEnd := chunkStart.AddDate(0, 0, maxChunkDays-1)
		if chunkEnd.After(endDate) {
			chunkEnd = endDate
		}

		url := fmt.Sprintf(
			"%s?latitude=%.4f&longitude=%.4f&start_date=%s&end_date=%s&daily=%s&timezone=auto",
			archiveURL, lat, lon,
			chunkStart.Format("2006-01-02"), chunkEnd.Format("2006-01-02"),
			archiveDailyVars,
		)

		resp, err := c.HTTPClient.Get(url)
		if err != nil {
			return nil, fmt.Errorf("archive API request failed: %w", err)
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close() //nolint:errcheck
			return nil, fmt.Errorf("archive API returned status %d for %s to %s",
				resp.StatusCode, chunkStart.Format("2006-01-02"), chunkEnd.Format("2006-01-02"))
		}

		var omResp openMeteoResponse
		if err := json.NewDecoder(resp.Body).Decode(&omResp); err != nil {
			resp.Body.Close() //nolint:errcheck
			return nil, fmt.Errorf("failed to decode archive response: %w", err)
		}
		resp.Body.Close() //nolint:errcheck

		days := parseDailyData(omResp)
		for _, d := range days {
			key := d.Date.Format("2006-01-02")
			if !seen[key] {
				seen[key] = true
				allData = append(allData, d)
			}
		}

		chunkStart = chunkEnd.AddDate(0, 0, 1)
	}

	return allData, nil
}

// CtoF converts Celsius to Fahrenheit.
func CtoF(c float64) float64 {
	return c*9.0/5.0 + 32.0
}

// MMtoIn converts millimeters to inches.
func MMtoIn(mm float64) float64 {
	return mm / 25.4
}

// MsToMph converts meters/sec to miles/hour.
func MsToMph(ms float64) float64 {
	return ms * 2.23694
}

package weather

import (
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestCtoF(t *testing.T) {
	tests := []struct {
		c, want float64
	}{
		{0, 32},
		{100, 212},
		{-40, -40},
		{20, 68},
	}
	for _, tt := range tests {
		got := CtoF(tt.c)
		if math.Abs(got-tt.want) > 0.01 {
			t.Errorf("CtoF(%v) = %v, want %v", tt.c, got, tt.want)
		}
	}
}

func TestMMtoIn(t *testing.T) {
	tests := []struct {
		mm, want float64
	}{
		{25.4, 1.0},
		{0, 0},
		{50.8, 2.0},
	}
	for _, tt := range tests {
		got := MMtoIn(tt.mm)
		if math.Abs(got-tt.want) > 0.001 {
			t.Errorf("MMtoIn(%v) = %v, want %v", tt.mm, got, tt.want)
		}
	}
}

func TestMsToMph(t *testing.T) {
	got := MsToMph(1.0)
	if math.Abs(got-2.23694) > 0.001 {
		t.Errorf("MsToMph(1) = %v, want 2.23694", got)
	}
}

func TestSanitize(t *testing.T) {
	if sanitize(math.NaN()) != 0 {
		t.Error("NaN should sanitize to 0")
	}
	if sanitize(math.Inf(1)) != 0 {
		t.Error("+Inf should sanitize to 0")
	}
	if sanitize(math.Inf(-1)) != 0 {
		t.Error("-Inf should sanitize to 0")
	}
	if sanitize(42.5) != 42.5 {
		t.Error("normal value should pass through")
	}
}

func TestSanitizePtr(t *testing.T) {
	if sanitizePtr(math.NaN()) != nil {
		t.Error("NaN should sanitize to nil")
	}
	p := sanitizePtr(42.5)
	if p == nil || *p != 42.5 {
		t.Error("normal value should return pointer")
	}
}

func TestParseDailyData(t *testing.T) {
	resp := openMeteoResponse{}
	resp.Daily.Time = []string{"2025-06-01", "2025-06-02"}
	resp.Daily.Temperature2mMax = []float64{30, 32}
	resp.Daily.Temperature2mMin = []float64{20, 22}
	resp.Daily.PrecipitationSum = []float64{5, 0}
	resp.Daily.PrecipitationProbabilityMax = []float64{80, 10}
	resp.Daily.Windspeed10mMax = []float64{5, 3}
	resp.Daily.Windgusts10mMax = []float64{10, 6}
	resp.Daily.WinddirectionDominant = []float64{180, 270}
	resp.Daily.ET0Evapotranspiration = []float64{4.5, 5.0}
	resp.Daily.RelativeHumidity2mMean = []float64{75, 65}
	resp.Daily.RelativeHumidity2mMax = []float64{90, 80}
	resp.Daily.RelativeHumidity2mMin = []float64{60, 50}
	resp.Daily.DewPoint2mMax = []float64{18, 16}
	resp.Daily.DewPoint2mMin = []float64{12, 10}
	resp.Daily.DewPoint2mMean = []float64{15, 13}
	resp.Daily.SunshineDuration = []float64{36000, 43200}

	data := parseDailyData(resp)
	if len(data) != 2 {
		t.Fatalf("expected 2 days, got %d", len(data))
	}

	if data[0].TemperatureMaxC != 30 {
		t.Errorf("day 1 tmax = %v, want 30", data[0].TemperatureMaxC)
	}
	if data[1].PrecipitationMM != 0 {
		t.Errorf("day 2 precip = %v, want 0", data[1].PrecipitationMM)
	}
	if data[0].RelativeHumidityMean == nil || *data[0].RelativeHumidityMean != 75 {
		t.Error("day 1 humidity mean should be 75")
	}
}

// makeArchiveResponse builds a minimal openMeteoResponse JSON with the given dates.
func makeArchiveResponse(dates []string) []byte {
	resp := openMeteoResponse{}
	resp.Daily.Time = dates
	n := len(dates)
	resp.Daily.Temperature2mMax = make([]float64, n)
	resp.Daily.Temperature2mMin = make([]float64, n)
	resp.Daily.PrecipitationSum = make([]float64, n)
	resp.Daily.Windspeed10mMax = make([]float64, n)
	resp.Daily.Windgusts10mMax = make([]float64, n)
	resp.Daily.WinddirectionDominant = make([]float64, n)
	resp.Daily.ET0Evapotranspiration = make([]float64, n)
	resp.Daily.RelativeHumidity2mMean = make([]float64, n)
	resp.Daily.RelativeHumidity2mMax = make([]float64, n)
	resp.Daily.RelativeHumidity2mMin = make([]float64, n)
	resp.Daily.DewPoint2mMax = make([]float64, n)
	resp.Daily.DewPoint2mMin = make([]float64, n)
	resp.Daily.DewPoint2mMean = make([]float64, n)
	resp.Daily.SunshineDuration = make([]float64, n)
	for i, d := range dates {
		resp.Daily.Temperature2mMax[i] = 25
		resp.Daily.Temperature2mMin[i] = 15
		_ = d
	}
	b, _ := json.Marshal(resp)
	return b
}

func TestFetchHistoricalWeatherChunking(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		startStr := r.URL.Query().Get("start_date")
		endStr := r.URL.Query().Get("end_date")
		start, _ := time.Parse("2006-01-02", startStr)
		end, _ := time.Parse("2006-01-02", endStr)

		var dates []string
		for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
			dates = append(dates, d.Format("2006-01-02"))
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(makeArchiveResponse(dates)) //nolint:errcheck
	}))
	defer server.Close()

	client := &Client{
		HTTPClient:     server.Client(),
		ArchiveBaseURL: server.URL,
	}

	// 200 days → ceil(200/45) = 5 chunks
	start := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 0, 199) // 200 days total

	data, err := client.FetchHistoricalWeather(40.0, -90.0, start, end)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if requestCount != 5 {
		t.Errorf("expected 5 HTTP requests, got %d", requestCount)
	}
	if len(data) != 200 {
		t.Errorf("expected 200 days of data, got %d", len(data))
	}

	// Verify no duplicate dates
	seen := map[string]bool{}
	for _, d := range data {
		key := d.Date.Format("2006-01-02")
		if seen[key] {
			t.Errorf("duplicate date: %s", key)
		}
		seen[key] = true
	}
}

func TestFetchHistoricalWeatherSingleChunk(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		startStr := r.URL.Query().Get("start_date")
		endStr := r.URL.Query().Get("end_date")
		start, _ := time.Parse("2006-01-02", startStr)
		end, _ := time.Parse("2006-01-02", endStr)

		var dates []string
		for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
			dates = append(dates, d.Format("2006-01-02"))
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(makeArchiveResponse(dates)) //nolint:errcheck
	}))
	defer server.Close()

	client := &Client{
		HTTPClient:     server.Client(),
		ArchiveBaseURL: server.URL,
	}

	start := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 0, 29) // 30 days

	data, err := client.FetchHistoricalWeather(40.0, -90.0, start, end)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if requestCount != 1 {
		t.Errorf("expected 1 HTTP request, got %d", requestCount)
	}
	if len(data) != 30 {
		t.Errorf("expected 30 days, got %d", len(data))
	}
}

func TestFetchHistoricalWeatherError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer server.Close()

	client := &Client{
		HTTPClient:     server.Client(),
		ArchiveBaseURL: server.URL,
	}

	start := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 0, 29)

	_, err := client.FetchHistoricalWeather(40.0, -90.0, start, end)
	if err == nil {
		t.Fatal("expected error for non-200 status")
	}
	if !strings.Contains(err.Error(), "status 400") {
		t.Errorf("error should mention status 400, got: %v", err)
	}
}

// --- FetchDailyWeather tests ---

func TestFetchDailyWeatherHappyPath(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := openMeteoResponse{}
		resp.Daily.Time = []string{"2025-06-01", "2025-06-02", "2025-06-03"}
		n := 3
		resp.Daily.Temperature2mMax = []float64{30, 32, 28}
		resp.Daily.Temperature2mMin = []float64{18, 20, 16}
		resp.Daily.PrecipitationSum = []float64{0, 5, 2}
		resp.Daily.PrecipitationProbabilityMax = []float64{10, 80, 40}
		resp.Daily.Windspeed10mMax = make([]float64, n)
		resp.Daily.Windgusts10mMax = make([]float64, n)
		resp.Daily.WinddirectionDominant = make([]float64, n)
		resp.Daily.ET0Evapotranspiration = []float64{4.0, 3.5, 4.2}
		resp.Daily.RelativeHumidity2mMean = []float64{70, 75, 65}
		resp.Daily.RelativeHumidity2mMax = []float64{90, 95, 85}
		resp.Daily.RelativeHumidity2mMin = []float64{50, 55, 45}
		resp.Daily.DewPoint2mMax = make([]float64, n)
		resp.Daily.DewPoint2mMin = make([]float64, n)
		resp.Daily.DewPoint2mMean = make([]float64, n)
		resp.Daily.SunshineDuration = make([]float64, n)

		w.Header().Set("Content-Type", "application/json")
		b, _ := json.Marshal(resp)
		w.Write(b) //nolint:errcheck
	}))
	defer server.Close()

	client := &Client{
		HTTPClient: server.Client(),
		BaseURL:    server.URL,
	}

	data, err := client.FetchDailyWeather(35.0, -85.0, 2, 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(data) != 3 {
		t.Fatalf("expected 3 days, got %d", len(data))
	}

	if data[0].TemperatureMaxC != 30 {
		t.Errorf("day 1 tmax = %v, want 30", data[0].TemperatureMaxC)
	}
	if data[1].PrecipitationMM != 5 {
		t.Errorf("day 2 precip = %v, want 5", data[1].PrecipitationMM)
	}
	if data[2].ET0MM != 4.2 {
		t.Errorf("day 3 ET0 = %v, want 4.2", data[2].ET0MM)
	}
	expectedDate := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)
	if !data[0].Date.Equal(expectedDate) {
		t.Errorf("day 1 date = %v, want %v", data[0].Date, expectedDate)
	}
}

func TestFetchDailyWeatherNon200(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := &Client{
		HTTPClient: server.Client(),
		BaseURL:    server.URL,
	}

	_, err := client.FetchDailyWeather(35.0, -85.0, 2, 1)
	if err == nil {
		t.Fatal("expected error for non-200 status")
	}
	if !strings.Contains(err.Error(), "status 500") {
		t.Errorf("error should mention status 500, got: %v", err)
	}
}

func TestFetchDailyWeatherInvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{invalid json`)) //nolint:errcheck
	}))
	defer server.Close()

	client := &Client{
		HTTPClient: server.Client(),
		BaseURL:    server.URL,
	}

	_, err := client.FetchDailyWeather(35.0, -85.0, 2, 1)
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
	if !strings.Contains(err.Error(), "decode") {
		t.Errorf("error should mention decode failure, got: %v", err)
	}
}

func TestParseDailyDataWithNaN(t *testing.T) {
	resp := openMeteoResponse{}
	resp.Daily.Time = []string{"2025-06-01"}
	resp.Daily.Temperature2mMax = []float64{math.NaN()}
	resp.Daily.Temperature2mMin = []float64{20}
	resp.Daily.PrecipitationSum = []float64{math.Inf(1)}
	resp.Daily.PrecipitationProbabilityMax = []float64{0}
	resp.Daily.Windspeed10mMax = []float64{0}
	resp.Daily.Windgusts10mMax = []float64{0}
	resp.Daily.WinddirectionDominant = []float64{0}
	resp.Daily.ET0Evapotranspiration = []float64{0}
	resp.Daily.RelativeHumidity2mMean = []float64{math.NaN()}

	data := parseDailyData(resp)
	if len(data) != 1 {
		t.Fatalf("expected 1 day, got %d", len(data))
	}

	if data[0].TemperatureMaxC != 0 {
		t.Errorf("NaN tmax should sanitize to 0, got %v", data[0].TemperatureMaxC)
	}
	if data[0].PrecipitationMM != 0 {
		t.Errorf("Inf precip should sanitize to 0, got %v", data[0].PrecipitationMM)
	}
	if data[0].RelativeHumidityMean != nil {
		t.Error("NaN humidity should sanitize to nil")
	}
}

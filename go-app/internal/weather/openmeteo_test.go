package weather

import (
	"math"
	"testing"
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

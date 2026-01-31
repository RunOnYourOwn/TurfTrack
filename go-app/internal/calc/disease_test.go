package calc

import (
	"math"
	"testing"
)

func TestSmithKernsRiskScore(t *testing.T) {
	tests := []struct {
		name    string
		avgTemp float64
		avgRH   float64
		wantMin float64
		wantMax float64
	}{
		{"typical summer conditions", 25, 80, 0.3, 0.9},
		{"cold temperature cutoff", 5, 80, -0.001, 0.001},
		{"hot temperature cutoff", 40, 80, -0.001, 0.001},
		{"low humidity low risk", 20, 30, 0, 0.1},
		{"high temp high humidity", 30, 90, 0.5, 1.0},
		{"boundary temp 10C", 10, 80, 0, 0.5},
		{"boundary temp 35C", 35, 80, 0, 1.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SmithKernsRiskScore(tt.avgTemp, tt.avgRH)
			if got < tt.wantMin || got > tt.wantMax {
				t.Errorf("SmithKernsRiskScore(%v, %v) = %v, want between %v and %v",
					tt.avgTemp, tt.avgRH, got, tt.wantMin, tt.wantMax)
			}
		})
	}
}

func TestSmithKernsRiskScoreFormula(t *testing.T) {
	// Verify exact formula: logit = -11.4041 + 0.1932*temp + 0.0894*rh
	// risk = exp(logit) / (1 + exp(logit))
	temp := 25.0
	rh := 80.0
	logit := -11.4041 + 0.1932*temp + 0.0894*rh
	expected := math.Exp(logit) / (1 + math.Exp(logit))

	got := SmithKernsRiskScore(temp, rh)
	if math.Abs(got-expected) > 0.0001 {
		t.Errorf("SmithKernsRiskScore(25, 80) = %v, want %v (exact formula)", got, expected)
	}
}

func TestCalculateDiseasePressure(t *testing.T) {
	// Need at least 5 days for moving average
	weather := []DiseaseWeatherDay{
		{AvgTempC: 20, RelativeHumidity: 75},
		{AvgTempC: 22, RelativeHumidity: 78},
		{AvgTempC: 24, RelativeHumidity: 80},
		{AvgTempC: 25, RelativeHumidity: 82},
		{AvgTempC: 26, RelativeHumidity: 85},
		{AvgTempC: 27, RelativeHumidity: 88},
		{AvgTempC: 28, RelativeHumidity: 90},
	}

	results := CalculateDiseasePressure(weather)
	if len(results) != 7 {
		t.Fatalf("expected 7 results, got %d", len(results))
	}

	// First 4 days should be nil (not enough data for 5-day avg)
	for i := 0; i < 4; i++ {
		if results[i] != nil {
			t.Errorf("day %d: expected nil (insufficient data), got %v", i, *results[i])
		}
	}

	// Day 5+ should have values
	for i := 4; i < 7; i++ {
		if results[i] == nil {
			t.Errorf("day %d: expected non-nil risk score", i)
		}
		if *results[i] < 0 || *results[i] > 1 {
			t.Errorf("day %d: risk score %v out of range [0,1]", i, *results[i])
		}
	}

	// Scores should increase as temp and humidity increase
	if results[4] != nil && results[6] != nil {
		if *results[6] <= *results[4] {
			t.Errorf("expected increasing risk: day5=%v, day7=%v", *results[4], *results[6])
		}
	}
}

func TestCalculateDiseasePressureColdCutoff(t *testing.T) {
	// All cold days - should produce zero risk
	weather := []DiseaseWeatherDay{
		{AvgTempC: 5, RelativeHumidity: 90},
		{AvgTempC: 5, RelativeHumidity: 90},
		{AvgTempC: 5, RelativeHumidity: 90},
		{AvgTempC: 5, RelativeHumidity: 90},
		{AvgTempC: 5, RelativeHumidity: 90},
	}

	results := CalculateDiseasePressure(weather)
	if results[4] == nil {
		t.Fatal("expected non-nil result for day 5")
	}
	if *results[4] != 0 {
		t.Errorf("expected 0 risk for cold temps, got %v", *results[4])
	}
}

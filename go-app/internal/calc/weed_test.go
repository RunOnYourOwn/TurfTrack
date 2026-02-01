package calc

import (
	"math"
	"testing"
)

func TestGDDRisk(t *testing.T) {
	tests := []struct {
		name       string
		gddAccum   float64
		threshold  float64
		wantScore  float64
	}{
		{"too early", 50, 200, 0.0},
		{"approaching 70%", 140, 200, 1.0},
		{"at threshold", 200, 200, 2.0},
		{"peak window 120%", 240, 200, 2.0},
		{"past peak 140%", 280, 200, 3.0},
		{"well past peak", 400, 200, 3.0},
		{"exactly 70%", 140, 200, 1.0},
		{"exactly 130%", 260, 200, 2.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := GDDRisk(tt.gddAccum, tt.threshold)
			if math.Abs(got-tt.wantScore) > 0.001 {
				t.Errorf("GDDRisk(%v, %v) = %v, want %v", tt.gddAccum, tt.threshold, got, tt.wantScore)
			}
		})
	}
}

func TestSoilTempRisk(t *testing.T) {
	tests := []struct {
		name      string
		soilTemp  float64
		optMin    float64
		optMax    float64
		wantScore float64
	}{
		{"too cold", 5, 10, 25, 0.0},
		{"optimal range", 15, 10, 25, 2.0},
		{"above optimal", 28, 10, 25, 1.0},
		{"way too hot", 35, 10, 25, 0.0},
		{"at min boundary", 10, 10, 25, 2.0},
		{"at max boundary", 25, 10, 25, 2.0},
		{"at max+5 boundary", 30, 10, 25, 1.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SoilTempRisk(tt.soilTemp, tt.optMin, tt.optMax)
			if math.Abs(got-tt.wantScore) > 0.001 {
				t.Errorf("SoilTempRisk(%v, %v, %v) = %v, want %v", tt.soilTemp, tt.optMin, tt.optMax, got, tt.wantScore)
			}
		})
	}
}

func TestMoistureRisk(t *testing.T) {
	tests := []struct {
		name      string
		precip3d  float64
		humidity  float64
		wantScore float64
	}{
		{"dry conditions", 5, 50, 0.0},
		{"moderate precip", 15, 50, 0.5},
		{"heavy precip", 30, 50, 1.0},
		{"dry high humidity", 5, 75, 0.5},
		{"wet high humidity", 30, 85, 2.0},
		{"moderate all", 15, 75, 1.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := MoistureRisk(tt.precip3d, tt.humidity)
			if math.Abs(got-tt.wantScore) > 0.001 {
				t.Errorf("MoistureRisk(%v, %v) = %v, want %v", tt.precip3d, tt.humidity, got, tt.wantScore)
			}
		})
	}
}

func TestSeasonalTiming(t *testing.T) {
	tests := []struct {
		name   string
		month  int
		season WeedSeasonType
		want   float64
	}{
		{"spring in march", 3, SeasonSpringCalc, 1.0},
		{"spring in july", 7, SeasonSpringCalc, 0.0},
		{"summer in july", 7, SeasonSummerCalc, 1.0},
		{"summer in march", 3, SeasonSummerCalc, 0.0},
		{"fall in october", 10, SeasonFallCalc, 1.0},
		{"fall in march", 3, SeasonFallCalc, 0.0},
		{"year round anytime", 6, SeasonYearRoundCalc, 1.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SeasonalTiming(tt.month, tt.season)
			if math.Abs(got-tt.want) > 0.001 {
				t.Errorf("SeasonalTiming(%v, %v) = %v, want %v", tt.month, tt.season, got, tt.want)
			}
		})
	}
}

func TestCompositeWeedPressure(t *testing.T) {
	score := CompositeWeedPressure(3.0, 2.0, 2.0, 2.0, 1.0)
	// max = 3*1.36 + 2*0.91 + 2*0.91 + 2*0.91 + 1*0.45 = 4.08 + 1.82 + 1.82 + 1.82 + 0.45 = 9.99
	if score < 0 || score > 10 {
		t.Errorf("CompositeWeedPressure out of range: %v", score)
	}

	// All zeros should give zero
	zero := CompositeWeedPressure(0, 0, 0, 0, 0)
	if zero != 0 {
		t.Errorf("all-zero inputs should give 0, got %v", zero)
	}

	// Max inputs should cap at 10
	maxScore := CompositeWeedPressure(3.0, 2.0, 2.0, 2.0, 1.0)
	if maxScore > 10.0 {
		t.Errorf("score should be capped at 10, got %v", maxScore)
	}
}

func TestEstimateSoilTemp(t *testing.T) {
	tests := []struct {
		name string
		airTemp float64
		month int
		want float64
	}{
		{"spring 20C", 20, 4, 16.0},   // 20 * 0.8
		{"summer 30C", 30, 7, 27.0},    // 30 * 0.9
		{"fall 15C", 15, 10, 12.75},    // 15 * 0.85
		{"winter 5C", 5, 1, 4.25},      // 5 * 0.85
		{"spring boundary march", 25, 3, 20.0},  // 25 * 0.8
		{"spring boundary may", 25, 5, 20.0},    // 25 * 0.8
		{"summer boundary june", 35, 6, 31.5},   // 35 * 0.9
		{"summer boundary aug", 35, 8, 31.5},    // 35 * 0.9
		{"fall boundary sept", 20, 9, 17.0},     // 20 * 0.85
		{"winter boundary dec", 0, 12, 0.0},     // 0 * 0.85
		{"negative temp winter", -10, 1, -8.5},  // -10 * 0.85
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := EstimateSoilTemp(tt.airTemp, tt.month)
			if math.Abs(got-tt.want) > 0.001 {
				t.Errorf("EstimateSoilTemp(%v, %v) = %v, want %v",
					tt.airTemp, tt.month, got, tt.want)
			}
		})
	}
}

func TestCompositeWeedPressureExactFormula(t *testing.T) {
	// Weights: gdd=1.36, soilTemp=0.91, moisture=0.91, turf=0.91, seasonal=0.45
	tests := []struct {
		name     string
		gdd      float64
		soil     float64
		moisture float64
		turf     float64
		seasonal float64
		want     float64
	}{
		{"all zeros", 0, 0, 0, 0, 0, 0},
		{"gdd only", 2.0, 0, 0, 0, 0, 2.72},        // 2*1.36
		{"soil only", 0, 2.0, 0, 0, 0, 1.82},        // 2*0.91
		{"all max inputs", 3.0, 2.0, 2.0, 2.0, 1.0,
			math.Min(3.0*1.36+2.0*0.91+2.0*0.91+2.0*0.91+1.0*0.45, 10.0)}, // 9.99
		{"exceeds cap", 3.0, 2.0, 2.0, 2.0, 1.0, 9.99}, // capped at 10
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CompositeWeedPressure(tt.gdd, tt.soil, tt.moisture, tt.turf, tt.seasonal)
			if math.Abs(got-tt.want) > 0.01 {
				t.Errorf("CompositeWeedPressure = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCompositeWeedPressureCap(t *testing.T) {
	// Even with extreme inputs, score should never exceed 10
	score := CompositeWeedPressure(3.0, 2.0, 2.0, 2.0, 1.0)
	if score > 10.0 {
		t.Errorf("score should be capped at 10, got %v", score)
	}
	// With artificially high inputs
	extreme := CompositeWeedPressure(10, 10, 10, 10, 10)
	if extreme > 10.0 {
		t.Errorf("extreme inputs should still cap at 10, got %v", extreme)
	}
}

func TestSeasonalTimingAllMonths(t *testing.T) {
	// Spring: March-May (3-5)
	for m := 1; m <= 12; m++ {
		got := SeasonalTiming(m, SeasonSpringCalc)
		want := 0.0
		if m >= 3 && m <= 5 {
			want = 1.0
		}
		if got != want {
			t.Errorf("SeasonalTiming(%d, spring) = %v, want %v", m, got, want)
		}
	}
	// Summer: June-Aug (6-8)
	for m := 1; m <= 12; m++ {
		got := SeasonalTiming(m, SeasonSummerCalc)
		want := 0.0
		if m >= 6 && m <= 8 {
			want = 1.0
		}
		if got != want {
			t.Errorf("SeasonalTiming(%d, summer) = %v, want %v", m, got, want)
		}
	}
	// Fall: Sept-Nov (9-11)
	for m := 1; m <= 12; m++ {
		got := SeasonalTiming(m, SeasonFallCalc)
		want := 0.0
		if m >= 9 && m <= 11 {
			want = 1.0
		}
		if got != want {
			t.Errorf("SeasonalTiming(%d, fall) = %v, want %v", m, got, want)
		}
	}
	// Year-round: always 1.0
	for m := 1; m <= 12; m++ {
		got := SeasonalTiming(m, SeasonYearRoundCalc)
		if got != 1.0 {
			t.Errorf("SeasonalTiming(%d, year_round) = %v, want 1.0", m, got)
		}
	}
}

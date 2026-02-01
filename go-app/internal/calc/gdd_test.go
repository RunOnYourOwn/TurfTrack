package calc

import (
	"math"
	"testing"
	"time"
)

func TestDailyGDD(t *testing.T) {
	tests := []struct {
		name     string
		tmax     float64
		tmin     float64
		baseTemp float64
		want     float64
	}{
		// Celsius test cases
		{"normal accumulation C", 30, 20, 10, 15},
		{"no accumulation below base C", 8, 2, 10, 0},
		{"exactly at base C", 15, 5, 10, 0},
		{"partial accumulation C", 15, 10, 10, 2.5},
		{"high temps C", 40, 30, 10, 25},
		{"zero base temp C", 20, 10, 0, 15},
		{"negative temps with positive base C", -5, -15, 10, 0},

		// Fahrenheit test cases (DailyGDD is unit-agnostic; same formula applies)
		// 86°F max, 68°F min, base 50°F → avg 77, daily = 77-50 = 27
		{"normal accumulation F", 86, 68, 50, 27},
		// 46°F max, 36°F min, base 50°F → avg 41, daily = max(0, 41-50) = 0
		{"no accumulation below base F", 46, 36, 50, 0},
		// 59°F max, 41°F min, base 50°F → avg 50, daily = 0
		{"exactly at base F", 59, 41, 50, 0},
		// 80°F max, 60°F min, base 50°F → avg 70, daily = 20
		{"typical spring day F", 80, 60, 50, 20},
		// 100°F max, 80°F min, base 50°F → avg 90, daily = 40
		{"hot summer day F", 100, 80, 50, 40},
		// Verify C and F produce equivalent results for same physical temperatures
		// 30°C = 86°F, 20°C = 68°F, base 10°C = 50°F
		// C: (30+20)/2 - 10 = 15     F: (86+68)/2 - 50 = 27
		// Ratio: 27/15 = 1.8 (= 9/5, the F/C scaling factor) ✓
		{"F result scales by 9/5 vs C", 86, 68, 50, 27},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DailyGDD(tt.tmax, tt.tmin, tt.baseTemp)
			if math.Abs(got-tt.want) > 0.001 {
				t.Errorf("DailyGDD(%v, %v, %v) = %v, want %v", tt.tmax, tt.tmin, tt.baseTemp, got, tt.want)
			}
		})
	}
}

func TestCalculateGDDSeries(t *testing.T) {
	weather := []WeatherDay{
		{TmaxC: 30, TminC: 20}, // daily = 15
		{TmaxC: 30, TminC: 20}, // daily = 15, cumulative = 30
		{TmaxC: 30, TminC: 20}, // daily = 15, cumulative = 45
	}
	dates := makeDates("2025-01-01", 3)

	values := CalculateGDDSeries(weather, 10, 100, false, dates, nil)
	if len(values) != 3 {
		t.Fatalf("expected 3 values, got %d", len(values))
	}
	if math.Abs(values[0].CumulativeGDD-15) > 0.001 {
		t.Errorf("day 1 cumulative = %v, want 15", values[0].CumulativeGDD)
	}
	if math.Abs(values[2].CumulativeGDD-45) > 0.001 {
		t.Errorf("day 3 cumulative = %v, want 45", values[2].CumulativeGDD)
	}
	for _, v := range values {
		if v.Run != 1 {
			t.Errorf("expected run 1, got %d", v.Run)
		}
	}
}

func TestCalculateGDDSeriesWithThresholdReset(t *testing.T) {
	weather := []WeatherDay{
		{TmaxC: 30, TminC: 20}, // daily=15, cum=15
		{TmaxC: 30, TminC: 20}, // daily=15, cum=30
		{TmaxC: 30, TminC: 20}, // daily=15, cum=45 >= threshold(40), reset next
		{TmaxC: 30, TminC: 20}, // new run: daily=15, cum=15 (reset day)
		{TmaxC: 30, TminC: 20}, // daily=15, cum=30
	}
	dates := makeDates("2025-01-01", 5)

	values := CalculateGDDSeries(weather, 10, 40, true, dates, nil)
	if len(values) != 5 {
		t.Fatalf("expected 5 values, got %d", len(values))
	}

	// First 3 values should be run 1
	if values[0].Run != 1 || values[1].Run != 1 || values[2].Run != 1 {
		t.Error("first 3 values should be run 1")
	}

	// Day 4 should be run 2 with cumulative = 15 (reset day starts new run with its own daily GDD)
	if values[3].Run != 2 {
		t.Errorf("day 4 run = %d, want 2", values[3].Run)
	}
	if math.Abs(values[3].CumulativeGDD-15) > 0.001 {
		t.Errorf("day 4 cumulative = %v, want 15 (reset day includes daily)", values[3].CumulativeGDD)
	}

	// Day 5 should be run 2 with cumulative = 30
	if values[4].Run != 2 {
		t.Errorf("day 5 run = %d, want 2", values[4].Run)
	}
	if math.Abs(values[4].CumulativeGDD-30) > 0.001 {
		t.Errorf("day 5 cumulative = %v, want 30", values[4].CumulativeGDD)
	}
}

func TestCalculateGDDSeriesNoReset(t *testing.T) {
	weather := []WeatherDay{
		{TmaxC: 30, TminC: 20}, // daily=15
		{TmaxC: 30, TminC: 20}, // daily=15, cum=30
		{TmaxC: 30, TminC: 20}, // daily=15, cum=45 (exceeds threshold but no reset)
		{TmaxC: 30, TminC: 20}, // daily=15, cum=60
	}
	dates := makeDates("2025-01-01", 4)

	values := CalculateGDDSeries(weather, 10, 40, false, dates, nil)
	if len(values) != 4 {
		t.Fatalf("expected 4 values, got %d", len(values))
	}

	// All should be run 1 since reset disabled
	for i, v := range values {
		if v.Run != 1 {
			t.Errorf("day %d: run = %d, want 1", i, v.Run)
		}
	}
	if math.Abs(values[3].CumulativeGDD-60) > 0.001 {
		t.Errorf("day 4 cumulative = %v, want 60", values[3].CumulativeGDD)
	}
}

func TestCalculateGDDSeriesWithManualReset(t *testing.T) {
	weather := []WeatherDay{
		{TmaxC: 30, TminC: 20}, // daily=15, cum=15
		{TmaxC: 30, TminC: 20}, // daily=15, cum=30
		{TmaxC: 30, TminC: 20}, // daily=15 - MANUAL RESET: run 2, cum=15
		{TmaxC: 30, TminC: 20}, // daily=15, cum=30
		{TmaxC: 30, TminC: 20}, // daily=15, cum=45
	}
	dates := makeDates("2025-01-01", 5)
	manualResets := []time.Time{dates[2]} // Reset on day 3

	values := CalculateGDDSeries(weather, 10, 0, false, dates, manualResets)
	if len(values) != 5 {
		t.Fatalf("expected 5 values, got %d", len(values))
	}

	// Days 1-2 should be run 1
	if values[0].Run != 1 || values[1].Run != 1 {
		t.Error("first 2 values should be run 1")
	}
	if math.Abs(values[1].CumulativeGDD-30) > 0.001 {
		t.Errorf("day 2 cumulative = %v, want 30", values[1].CumulativeGDD)
	}

	// Day 3 should be run 2 (manual reset), cumulative = 15
	if values[2].Run != 2 {
		t.Errorf("day 3 run = %d, want 2", values[2].Run)
	}
	if math.Abs(values[2].CumulativeGDD-15) > 0.001 {
		t.Errorf("day 3 cumulative = %v, want 15", values[2].CumulativeGDD)
	}

	// Days 4-5 should continue run 2
	if values[3].Run != 2 || values[4].Run != 2 {
		t.Error("days 4-5 should be run 2")
	}
	if math.Abs(values[4].CumulativeGDD-45) > 0.001 {
		t.Errorf("day 5 cumulative = %v, want 45", values[4].CumulativeGDD)
	}
}

func TestCalculateGDDSeriesWithBothResetTypes(t *testing.T) {
	// Manual reset on day 3, threshold reset should trigger after that
	weather := []WeatherDay{
		{TmaxC: 30, TminC: 20}, // daily=15, cum=15, run 1
		{TmaxC: 30, TminC: 20}, // daily=15, cum=30, run 1
		{TmaxC: 30, TminC: 20}, // daily=15 - MANUAL RESET: run 2, cum=15
		{TmaxC: 30, TminC: 20}, // daily=15, cum=30, run 2
		{TmaxC: 30, TminC: 20}, // daily=15, cum=45 >= threshold(40), reset next
		{TmaxC: 30, TminC: 20}, // threshold reset: run 3, cum=15
	}
	dates := makeDates("2025-01-01", 6)
	manualResets := []time.Time{dates[2]}

	values := CalculateGDDSeries(weather, 10, 40, true, dates, manualResets)
	if len(values) != 6 {
		t.Fatalf("expected 6 values, got %d", len(values))
	}

	// Run 1: days 1-2
	if values[0].Run != 1 || values[1].Run != 1 {
		t.Error("days 1-2 should be run 1")
	}

	// Run 2: days 3-5 (manual reset on day 3)
	if values[2].Run != 2 || values[3].Run != 2 || values[4].Run != 2 {
		t.Errorf("days 3-5 should be run 2, got %d %d %d", values[2].Run, values[3].Run, values[4].Run)
	}

	// Run 3: day 6 (threshold reset)
	if values[5].Run != 3 {
		t.Errorf("day 6 run = %d, want 3", values[5].Run)
	}
	if math.Abs(values[5].CumulativeGDD-15) > 0.001 {
		t.Errorf("day 6 cumulative = %v, want 15", values[5].CumulativeGDD)
	}
}

func TestManualResetOverridesThresholdOnSameDay(t *testing.T) {
	// If threshold would trigger and manual reset is on the same day,
	// manual reset takes priority
	weather := []WeatherDay{
		{TmaxC: 30, TminC: 20}, // daily=15, cum=15
		{TmaxC: 30, TminC: 20}, // daily=15, cum=30
		{TmaxC: 30, TminC: 20}, // daily=15, cum=45 >= 40 threshold, but also manual reset
		{TmaxC: 30, TminC: 20}, // should be run 2 continued, not run 3
	}
	dates := makeDates("2025-01-01", 4)
	// Manual reset on day 3 (same day threshold would trigger resetNext)
	manualResets := []time.Time{dates[2]}

	values := CalculateGDDSeries(weather, 10, 40, true, dates, manualResets)

	// Day 3: manual reset -> run 2, cum=15
	if values[2].Run != 2 {
		t.Errorf("day 3 run = %d, want 2 (manual reset)", values[2].Run)
	}
	// Day 4: should continue run 2 (manual reset cleared resetNext)
	if values[3].Run != 2 {
		t.Errorf("day 4 run = %d, want 2 (continued after manual reset)", values[3].Run)
	}
}

func TestDailyGDDFahrenheitCelsiusEquivalence(t *testing.T) {
	// Verify that GDD calculated in F and C for the same physical temperatures
	// differ by exactly the 9/5 scaling factor.
	// Physical temps: max=30°C (86°F), min=20°C (68°F), base=10°C (50°F)
	gddC := DailyGDD(30, 20, 10)  // = 15
	gddF := DailyGDD(86, 68, 50)  // = 27
	ratio := gddF / gddC          // should be 9/5 = 1.8
	if math.Abs(ratio-1.8) > 0.001 {
		t.Errorf("F/C GDD ratio = %v, want 1.8 (9/5)", ratio)
	}

	// Another check: max=25°C (77°F), min=15°C (59°F), base=10°C (50°F)
	gddC2 := DailyGDD(25, 15, 10) // avg=20, daily=10
	gddF2 := DailyGDD(77, 59, 50) // avg=68, daily=18
	ratio2 := gddF2 / gddC2
	if math.Abs(ratio2-1.8) > 0.001 {
		t.Errorf("F/C GDD ratio (case 2) = %v, want 1.8 (9/5)", ratio2)
	}
}

func TestCalculateGDDSeriesFahrenheit(t *testing.T) {
	// Simulate a GDD model with Fahrenheit base temp of 50°F.
	// Weather stored as Celsius gets converted to F before calling this function
	// (as the scheduler does in RecalculateGDDForModel).
	// Day temps in F: max=86°F, min=68°F → daily = (86+68)/2 - 50 = 27
	weather := []WeatherDay{
		{TmaxC: 86, TminC: 68}, // Using F values in the struct (as scheduler does)
		{TmaxC: 86, TminC: 68}, // daily=27, cum=54
		{TmaxC: 86, TminC: 68}, // daily=27, cum=81
	}
	dates := makeDates("2025-06-01", 3)

	values := CalculateGDDSeries(weather, 50, 0, false, dates, nil)
	if len(values) != 3 {
		t.Fatalf("expected 3 values, got %d", len(values))
	}
	if math.Abs(values[0].DailyGDD-27) > 0.001 {
		t.Errorf("day 1 daily = %v, want 27", values[0].DailyGDD)
	}
	if math.Abs(values[0].CumulativeGDD-27) > 0.001 {
		t.Errorf("day 1 cumulative = %v, want 27", values[0].CumulativeGDD)
	}
	if math.Abs(values[2].CumulativeGDD-81) > 0.001 {
		t.Errorf("day 3 cumulative = %v, want 81", values[2].CumulativeGDD)
	}
}

func TestCalculateGDDSeriesFahrenheitWithThresholdReset(t *testing.T) {
	// Crabgrass preventer example: base 50°F, threshold 200 GDD-F
	// Daily GDD at 86°F/68°F = 27 per day
	// Reaches 200 around day 8 (27*7=189, 27*8=216 >= 200)
	weather := make([]WeatherDay, 10)
	for i := range weather {
		weather[i] = WeatherDay{TmaxC: 86, TminC: 68} // 27 GDD-F/day
	}
	dates := makeDates("2025-04-01", 10)

	values := CalculateGDDSeries(weather, 50, 200, true, dates, nil)

	// Day 7: cum = 189 (still run 1)
	if values[6].Run != 1 {
		t.Errorf("day 7 run = %d, want 1", values[6].Run)
	}
	if math.Abs(values[6].CumulativeGDD-189) > 0.001 {
		t.Errorf("day 7 cumulative = %v, want 189", values[6].CumulativeGDD)
	}

	// Day 8: cum = 216 >= 200, triggers reset next
	if values[7].Run != 1 {
		t.Errorf("day 8 run = %d, want 1 (reset happens NEXT day)", values[7].Run)
	}
	if math.Abs(values[7].CumulativeGDD-216) > 0.001 {
		t.Errorf("day 8 cumulative = %v, want 216", values[7].CumulativeGDD)
	}

	// Day 9: reset → run 2, cum = 27
	if values[8].Run != 2 {
		t.Errorf("day 9 run = %d, want 2", values[8].Run)
	}
	if math.Abs(values[8].CumulativeGDD-27) > 0.001 {
		t.Errorf("day 9 cumulative = %v, want 27", values[8].CumulativeGDD)
	}
}

func TestCalculateGDDSeriesEmptyWeather(t *testing.T) {
	values := CalculateGDDSeries(nil, 10, 0, false, nil, nil)
	if len(values) != 0 {
		t.Errorf("expected 0 values for empty weather, got %d", len(values))
	}

	values = CalculateGDDSeries([]WeatherDay{}, 10, 0, false, []time.Time{}, nil)
	if len(values) != 0 {
		t.Errorf("expected 0 values for empty slice, got %d", len(values))
	}
}

// makeDates creates sequential dates starting from the given date string.
func makeDates(start string, n int) []time.Time {
	t, _ := time.Parse("2006-01-02", start)
	dates := make([]time.Time, n)
	for i := range dates {
		dates[i] = t.AddDate(0, 0, i)
	}
	return dates
}

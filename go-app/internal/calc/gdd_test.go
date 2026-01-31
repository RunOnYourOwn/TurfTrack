package calc

import (
	"math"
	"testing"
)

func TestDailyGDD(t *testing.T) {
	tests := []struct {
		name     string
		tmax     float64
		tmin     float64
		baseTemp float64
		want     float64
	}{
		{"normal accumulation", 30, 20, 10, 15},
		{"no accumulation below base", 8, 2, 10, 0},
		{"exactly at base", 15, 5, 10, 0},
		{"partial accumulation", 15, 10, 10, 2.5},
		{"high temps", 40, 30, 10, 25},
		{"zero base temp", 20, 10, 0, 15},
		{"negative temps with positive base", -5, -15, 10, 0},
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

	values := CalculateGDDSeries(weather, 10, 100, false)
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
		{TmaxC: 30, TminC: 20}, // new run: daily=15, cum=0 (reset day)
		{TmaxC: 30, TminC: 20}, // daily=15, cum=15
	}

	values := CalculateGDDSeries(weather, 10, 40, true)
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

	values := CalculateGDDSeries(weather, 10, 40, false)
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

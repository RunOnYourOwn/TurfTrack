package calc

import (
	"math"
	"testing"
)

func TestGrowthPotentialColdSeason(t *testing.T) {
	tests := []struct {
		name  string
		tempC float64
		want  float64
		tol   float64
	}{
		{"optimal temp 20C", 20, 1.0, 0.001},
		{"10C below optimal", 10, 0.19, 0.05},
		{"5C above optimal", 25, 0.0, 0.7},
		{"very cold", 0, 0.0, 0.01},
		{"very hot", 40, 0.0, 0.01},
		{"15C approaching optimal", 15, 0.5, 0.45},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := GrowthPotentialScore(tt.tempC, GrassTypeCold)
			if math.Abs(got-tt.want) > tt.tol {
				t.Errorf("GrowthPotentialScore(%v, cold) = %v, want ~%v (tol %v)", tt.tempC, got, tt.want, tt.tol)
			}
		})
	}
}

func TestGrowthPotentialWarmSeason(t *testing.T) {
	tests := []struct {
		name  string
		tempC float64
		want  float64
		tol   float64
	}{
		{"optimal temp 31C", 31, 1.0, 0.001},
		{"20C for warm", 20, 0.0, 0.6},
		{"very cold 5C", 5, 0.0, 0.01},
		{"very hot 45C", 45, 0.0, 0.15},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := GrowthPotentialScore(tt.tempC, GrassTypeWarm)
			if math.Abs(got-tt.want) > tt.tol {
				t.Errorf("GrowthPotentialScore(%v, warm) = %v, want ~%v (tol %v)", tt.tempC, got, tt.want, tt.tol)
			}
		})
	}
}

func TestGrowthPotentialFormula(t *testing.T) {
	// Cold season: GP = exp(-0.5 * ((temp - 20) / 5.5)^2)
	temp := 15.0
	x := (temp - 20) / 5.5
	expected := math.Exp(-0.5 * x * x)
	got := GrowthPotentialScore(temp, GrassTypeCold)
	if math.Abs(got-expected) > 0.0001 {
		t.Errorf("GrowthPotentialScore(15, cold) = %v, want %v", got, expected)
	}

	// Warm season: GP = exp(-0.5 * ((temp - 31) / 7)^2)
	temp = 25.0
	x = (temp - 31) / 7
	expected = math.Exp(-0.5 * x * x)
	got = GrowthPotentialScore(temp, GrassTypeWarm)
	if math.Abs(got-expected) > 0.0001 {
		t.Errorf("GrowthPotentialScore(25, warm) = %v, want %v", got, expected)
	}
}

func TestRollingAverage(t *testing.T) {
	values := []float64{1, 2, 3, 4, 5, 6, 7}

	avg3 := RollingAverage(values, 3)
	if len(avg3) != 7 {
		t.Fatalf("expected 7 values, got %d", len(avg3))
	}
	// First 2 should be nil
	if avg3[0] != nil || avg3[1] != nil {
		t.Error("first 2 values should be nil for 3-day average")
	}
	// Third value: avg(1,2,3) = 2.0
	if avg3[2] == nil || math.Abs(*avg3[2]-2.0) > 0.001 {
		t.Errorf("3-day avg at index 2 = %v, want 2.0", avg3[2])
	}
	// Last value: avg(5,6,7) = 6.0
	if avg3[6] == nil || math.Abs(*avg3[6]-6.0) > 0.001 {
		t.Errorf("3-day avg at index 6 = %v, want 6.0", avg3[6])
	}
}

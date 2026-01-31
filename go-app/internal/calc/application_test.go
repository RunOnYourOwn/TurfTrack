package calc

import (
	"math"
	"testing"
)

func TestConvertToBaseUnit(t *testing.T) {
	tests := []struct {
		name   string
		amount float64
		unit   string
		want   float64
	}{
		{"lbs identity", 10, "lbs", 10},
		{"oz to lbs", 16, "oz", 1},
		{"kg to lbs", 1, "kg", 2.20462},
		{"g to lbs", 1000, "g", 2.20462},
		{"gal to fl_oz", 1, "gal", 128},
		{"qt to fl_oz", 1, "qt", 32},
		{"pt to fl_oz", 1, "pt", 16},
		{"fl_oz identity", 10, "fl_oz", 10},
		{"L to fl_oz", 1, "L", 33.814},
		{"mL to fl_oz", 1000, "mL", 33.814},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ConvertToBaseUnit(tt.amount, tt.unit)
			if math.Abs(got-tt.want) > 0.01 {
				t.Errorf("ConvertToBaseUnit(%v, %v) = %v, want %v", tt.amount, tt.unit, got, tt.want)
			}
		})
	}
}

func TestCalculateNutrientApplied(t *testing.T) {
	// 10 lbs product with 20% N applied per 1000 sqft
	baseAmount := 10.0
	nPct := 20.0
	expected := 2.0 // 10 * 20/100

	got := NutrientApplied(baseAmount, nPct)
	if math.Abs(got-expected) > 0.001 {
		t.Errorf("NutrientApplied(%v, %v) = %v, want %v", baseAmount, nPct, got, expected)
	}
}

func TestCalculateApplicationCost(t *testing.T) {
	// Product: $50/bag, 50 lbs/bag = $1/lb
	// Applied 5 lbs per 1000 sqft, lawn is 5000 sqft, area_unit=1000
	costPerLb := 1.0
	baseAmount := 5.0
	lawnArea := 5000.0
	areaUnit := 1000.0

	got := ApplicationCost(costPerLb, baseAmount, lawnArea, areaUnit)
	// 1.0 * 5 * (5000/1000) = 25
	expected := 25.0
	if math.Abs(got-expected) > 0.001 {
		t.Errorf("ApplicationCost = %v, want %v", got, expected)
	}
}

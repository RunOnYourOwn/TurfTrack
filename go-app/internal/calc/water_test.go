package calc

import (
	"math"
	"testing"
)

func TestWaterDeficit(t *testing.T) {
	tests := []struct {
		name          string
		et0Total      float64
		precipitation float64
		irrigation    float64
		wantDeficit   float64
		wantStatus    string
	}{
		{"no deficit", 1.0, 0.5, 0.5, 0.0, "excellent"},
		{"surplus", 1.0, 1.5, 0.5, -1.0, "excellent"},
		{"small deficit", 1.5, 0.5, 0.5, 0.5, "good"},
		{"moderate deficit", 2.0, 0.5, 0.5, 1.0, "warning"},
		{"large deficit", 3.0, 0.5, 0.0, 2.5, "critical"},
		{"no water", 2.0, 0.0, 0.0, 2.0, "critical"},
		{"boundary good/warning", 1.5, 0.5, 0.0, 1.0, "warning"},
		{"just under good", 1.0, 0.5, 0.0, 0.5, "good"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			deficit, status := WaterBalance(tt.et0Total, tt.precipitation, tt.irrigation)
			if math.Abs(deficit-tt.wantDeficit) > 0.001 {
				t.Errorf("WaterBalance deficit = %v, want %v", deficit, tt.wantDeficit)
			}
			if status != tt.wantStatus {
				t.Errorf("WaterBalance status = %v, want %v", status, tt.wantStatus)
			}
		})
	}
}

func TestWaterStatusThresholds(t *testing.T) {
	// Verify exact thresholds
	_, s1 := WaterBalance(1.0, 1.0, 0.0) // deficit = 0
	if s1 != "excellent" {
		t.Errorf("deficit 0 should be excellent, got %s", s1)
	}

	_, s2 := WaterBalance(1.5, 1.0, 0.0) // deficit = 0.5
	if s2 != "good" {
		t.Errorf("deficit 0.5 should be good, got %s", s2)
	}

	_, s3 := WaterBalance(2.0, 1.0, 0.0) // deficit = 1.0
	if s3 != "warning" {
		t.Errorf("deficit 1.0 should be warning, got %s", s3)
	}

	_, s4 := WaterBalance(2.1, 1.0, 0.0) // deficit = 1.1
	if s4 != "critical" {
		t.Errorf("deficit 1.1 should be critical, got %s", s4)
	}
}

func TestWaterBalanceDeficitCalculation(t *testing.T) {
	// Verify the deficit formula: ET0 - precipitation - irrigation
	tests := []struct {
		name        string
		et0         float64
		precip      float64
		irrigation  float64
		wantDeficit float64
	}{
		{"all zeros", 0, 0, 0, 0},
		{"only et0", 2.5, 0, 0, 2.5},
		{"only precip", 0, 1.5, 0, -1.5},
		{"only irrigation", 0, 0, 1.0, -1.0},
		{"realistic week", 1.75, 0.5, 0.75, 0.5},
		{"heavy rain week", 1.5, 3.0, 0, -1.5},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			deficit, _ := WaterBalance(tt.et0, tt.precip, tt.irrigation)
			if math.Abs(deficit-tt.wantDeficit) > 0.001 {
				t.Errorf("WaterBalance deficit = %v, want %v", deficit, tt.wantDeficit)
			}
		})
	}
}

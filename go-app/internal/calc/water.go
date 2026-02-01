package calc

// WaterBalance calculates the water deficit and status for a period.
// All values are in inches.
// Returns (deficit, status) where status is one of: excellent, good, warning, critical.
func WaterBalance(et0Total, precipitationTotal, irrigationApplied float64) (float64, string) {
	deficit := et0Total - precipitationTotal - irrigationApplied

	var status string
	switch {
	case deficit <= 0:
		status = "excellent"
	case deficit <= 0.5:
		status = "good"
	case deficit <= 1.0:
		status = "warning"
	default:
		status = "critical"
	}

	return deficit, status
}

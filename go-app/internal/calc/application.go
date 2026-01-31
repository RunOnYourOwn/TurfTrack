package calc

// Unit conversion factors.
var granularToLbs = map[string]float64{
	"lbs": 1.0,
	"oz":  1.0 / 16.0,
	"kg":  2.20462,
	"g":   0.00220462,
	"bags": 1.0,
	"tablets": 1.0,
}

var liquidToFlOz = map[string]float64{
	"gal":   128.0,
	"qt":    32.0,
	"pt":    16.0,
	"fl_oz": 1.0,
	"L":     33.814,
	"mL":    0.033814,
}

// ConvertToBaseUnit converts an amount in the given unit to the base unit.
// Granular products convert to lbs; liquid products convert to fl_oz.
func ConvertToBaseUnit(amount float64, unit string) float64 {
	if factor, ok := granularToLbs[unit]; ok {
		return amount * factor
	}
	if factor, ok := liquidToFlOz[unit]; ok {
		return amount * factor
	}
	return amount
}

// NutrientApplied calculates the amount of nutrient applied.
// baseAmount is in the base unit (lbs or fl_oz).
// pct is the nutrient percentage (0-100).
func NutrientApplied(baseAmount, pct float64) float64 {
	return baseAmount * (pct / 100)
}

// ApplicationCost calculates the total cost of an application.
// costPerLb is the cost per pound of product.
// baseAmount is the amount per area unit (in base units).
// lawnArea is the total lawn area.
// areaUnit is the per-area denominator (e.g., 1000 for "per 1000 sqft").
func ApplicationCost(costPerLb, baseAmount, lawnArea, areaUnit float64) float64 {
	if areaUnit == 0 {
		return 0
	}
	return costPerLb * baseAmount * (lawnArea / areaUnit)
}

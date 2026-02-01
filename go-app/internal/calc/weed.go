package calc

import "math"

// GDDRisk calculates the GDD-based weed emergence risk score (0-3).
func GDDRisk(gddAccumulated, emergenceThreshold float64) float64 {
	ratio := gddAccumulated / emergenceThreshold
	switch {
	case ratio < 0.7:
		return 0.0
	case ratio < 1.0:
		return 1.0
	case ratio <= 1.3:
		return 2.0
	default:
		return 3.0
	}
}

// SoilTempRisk calculates the soil temperature risk score (0-2).
func SoilTempRisk(soilTempC, optMinC, optMaxC float64) float64 {
	switch {
	case soilTempC < optMinC:
		return 0.0
	case soilTempC <= optMaxC:
		return 2.0
	case soilTempC <= optMaxC+5:
		return 1.0
	default:
		return 0.0
	}
}

// MoistureRisk calculates the moisture-based risk score (0-2).
// precip3dMM is the 3-day precipitation total in mm.
// humidityAvg is the 7-day average relative humidity (%).
func MoistureRisk(precip3dMM, humidityAvg float64) float64 {
	var precipScore float64
	switch {
	case precip3dMM > 25:
		precipScore = 1.0
	case precip3dMM > 12:
		precipScore = 0.5
	default:
		precipScore = 0.0
	}

	var humidScore float64
	switch {
	case humidityAvg > 80:
		humidScore = 1.0
	case humidityAvg > 70:
		humidScore = 0.5
	default:
		humidScore = 0.0
	}

	return precipScore + humidScore
}

// SeasonalTiming returns 1.0 if the month matches the weed's active season, else 0.0.
func SeasonalTiming(month int, season WeedSeasonType) float64 {
	switch season {
	case SeasonSpringCalc:
		if month >= 3 && month <= 5 {
			return 1.0
		}
	case SeasonSummerCalc:
		if month >= 6 && month <= 8 {
			return 1.0
		}
	case SeasonFallCalc:
		if month >= 9 && month <= 11 {
			return 1.0
		}
	case SeasonYearRoundCalc:
		return 1.0
	}
	return 0.0
}

// EstimateSoilTemp estimates soil temperature from air temperature and month.
// Uses seasonal adjustment factors: spring=0.8, summer=0.9, fall/winter=0.85.
func EstimateSoilTemp(airTempC float64, month int) float64 {
	var factor float64
	switch {
	case month >= 3 && month <= 5:
		factor = 0.8
	case month >= 6 && month <= 8:
		factor = 0.9
	default:
		factor = 0.85
	}
	return airTempC * factor
}

// CompositeWeedPressure calculates the weighted composite weed pressure score (0-10).
func CompositeWeedPressure(gddRisk, soilTempRisk, moistureRisk, turfStress, seasonalTiming float64) float64 {
	score := gddRisk*1.36 + soilTempRisk*0.91 + moistureRisk*0.91 + turfStress*0.91 + seasonalTiming*0.45
	return math.Min(score, 10.0)
}

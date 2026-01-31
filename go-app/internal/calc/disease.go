package calc

import "math"

// Smith-Kerns dollar spot disease model coefficients.
const (
	skB0 = -11.4041
	skB1 = 0.1932
	skB2 = 0.0894
)

// SmithKernsRiskScore calculates the dollar spot risk using the Smith-Kerns logit model.
// avgTemp is the 5-day moving average temperature in Celsius.
// avgRH is the 5-day moving average relative humidity (%).
// Returns a value between 0 and 1. Returns 0 if temperature is outside [10, 35]C.
func SmithKernsRiskScore(avgTemp, avgRH float64) float64 {
	if avgTemp < 10 || avgTemp > 35 {
		return 0
	}
	logit := skB0 + skB1*avgTemp + skB2*avgRH
	return math.Exp(logit) / (1 + math.Exp(logit))
}

// CalculateDiseasePressure calculates Smith-Kerns risk scores for a series of weather days.
// Uses a 5-day moving average of temperature and humidity.
// Returns a slice of *float64 (nil for days with insufficient data).
func CalculateDiseasePressure(weather []DiseaseWeatherDay) []*float64 {
	results := make([]*float64, len(weather))
	windowSize := 5

	for i := range weather {
		if i < windowSize-1 {
			results[i] = nil
			continue
		}

		var sumTemp, sumRH float64
		for j := i - windowSize + 1; j <= i; j++ {
			sumTemp += weather[j].AvgTempC
			sumRH += weather[j].RelativeHumidity
		}

		avgTemp := sumTemp / float64(windowSize)
		avgRH := sumRH / float64(windowSize)

		score := SmithKernsRiskScore(avgTemp, avgRH)
		results[i] = &score
	}

	return results
}

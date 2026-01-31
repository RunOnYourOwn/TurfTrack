package calc

import "math"

// Growth potential parameters by grass type.
var gpParams = map[GrassTypeCalc]struct{ tOpt, sigma float64 }{
	GrassTypeCold: {20.0, 5.5},
	GrassTypeWarm: {31.0, 7.0},
}

// GrowthPotentialScore calculates the growth potential using a Gaussian distribution.
// Formula: GP = exp(-0.5 * ((temp - t_opt) / sigma)^2)
// Returns a value between 0 and 1.
func GrowthPotentialScore(tempC float64, grassType GrassTypeCalc) float64 {
	p, ok := gpParams[grassType]
	if !ok {
		return 0
	}
	return math.Exp(-0.5 * math.Pow((tempC-p.tOpt)/p.sigma, 2))
}

// RollingAverage calculates a rolling average over the given window size.
// Returns nil for positions where there isn't enough data.
func RollingAverage(values []float64, window int) []*float64 {
	result := make([]*float64, len(values))
	for i := range values {
		if i < window-1 {
			result[i] = nil
			continue
		}
		var sum float64
		for j := i - window + 1; j <= i; j++ {
			sum += values[j]
		}
		avg := sum / float64(window)
		result[i] = &avg
	}
	return result
}

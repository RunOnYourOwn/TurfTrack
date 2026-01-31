package calc

import "math"

// DailyGDD calculates the growing degree days for a single day.
// Formula: max(0, ((tmax + tmin) / 2) - baseTemp)
func DailyGDD(tmax, tmin, baseTemp float64) float64 {
	return math.Max(0, (tmax+tmin)/2-baseTemp)
}

// CalculateGDDSeries calculates a series of GDD values with optional threshold reset.
// When resetOnThreshold is true and cumulative GDD reaches the threshold,
// the next day starts a new run with cumulative reset to 0.
func CalculateGDDSeries(weather []WeatherDay, baseTemp, threshold float64, resetOnThreshold bool) []GDDResult {
	results := make([]GDDResult, len(weather))
	cumulative := 0.0
	run := 1
	resetNext := false

	for i, w := range weather {
		daily := DailyGDD(w.TmaxC, w.TminC, baseTemp)

		if resetNext {
			run++
			cumulative = daily // new run starts with this day's GDD
			resetNext = false
			results[i] = GDDResult{
				DailyGDD:      daily,
				CumulativeGDD: cumulative,
				Run:           run,
			}
			if resetOnThreshold && cumulative >= threshold {
				resetNext = true
			}
			continue
		}

		cumulative += daily

		results[i] = GDDResult{
			DailyGDD:      daily,
			CumulativeGDD: cumulative,
			Run:           run,
		}

		// Check threshold - if exceeded, reset NEXT day
		if resetOnThreshold && cumulative >= threshold {
			resetNext = true
		}
	}

	return results
}

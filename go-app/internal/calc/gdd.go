package calc

import (
	"math"
	"time"
)

// DailyGDD calculates the growing degree days for a single day.
// Formula: max(0, ((tmax + tmin) / 2) - baseTemp)
func DailyGDD(tmax, tmin, baseTemp float64) float64 {
	return math.Max(0, (tmax+tmin)/2-baseTemp)
}

// CalculateGDDSeries calculates a series of GDD values with optional threshold reset
// and manual reset dates. Manual resets take priority over threshold resets.
// When resetOnThreshold is true and cumulative GDD reaches the threshold,
// the next day starts a new run with cumulative reset to 0.
// Manual resets immediately start a new run on the specified date.
func CalculateGDDSeries(weather []WeatherDay, baseTemp, threshold float64, resetOnThreshold bool, dates []time.Time, manualResetDates []time.Time) []GDDResult {
	results := make([]GDDResult, len(weather))
	cumulative := 0.0
	run := 1
	resetNext := false

	// Build lookup set for manual reset dates
	manualResets := make(map[string]bool, len(manualResetDates))
	for _, d := range manualResetDates {
		manualResets[d.Format("2006-01-02")] = true
	}

	for i, w := range weather {
		daily := DailyGDD(w.TmaxC, w.TminC, baseTemp)

		// Check if this day is a manual reset
		isManualReset := false
		if len(dates) > i {
			isManualReset = manualResets[dates[i].Format("2006-01-02")]
		}

		if isManualReset {
			// Manual reset: start new run, cumulative starts with this day's GDD
			run++
			cumulative = daily
			resetNext = false
			results[i] = GDDResult{
				DailyGDD:      daily,
				CumulativeGDD: cumulative,
				Run:           run,
			}
			if resetOnThreshold && threshold > 0 && cumulative >= threshold {
				resetNext = true
			}
			continue
		}

		if resetNext {
			run++
			cumulative = daily // new run starts with this day's GDD
			resetNext = false
			results[i] = GDDResult{
				DailyGDD:      daily,
				CumulativeGDD: cumulative,
				Run:           run,
			}
			if resetOnThreshold && threshold > 0 && cumulative >= threshold {
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
		if resetOnThreshold && threshold > 0 && cumulative >= threshold {
			resetNext = true
		}
	}

	return results
}

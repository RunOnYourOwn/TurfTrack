import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "../lib/fetcher";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveLine } from "@nivo/line";
import DateRangePopover from "./DateRangePopover";
import { format, parseISO } from "date-fns";

const MIN_COLOR = "#60a5fa"; // blue
const MAX_COLOR = "#f59e42"; // orange

// Types
interface Location {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

interface WeatherEntry {
  date: string;
  type: "historical" | "forecast";
  temperature_max_c: number;
  temperature_max_f: number;
  temperature_min_c: number;
  temperature_min_f: number;
  // ...other fields omitted for brevity
}

// Custom tooltip for Nivo (formats to 2 decimals and always shows label)
const seriesLabels = ["Min Temperature", "Max Temperature"];

const CustomTooltip = ({ slice }: { slice: any }) => (
  <div
    style={{
      background: "#222",
      color: "#fff",
      padding: 8,
      borderRadius: 6,
      fontSize: 13,
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      minWidth: 120,
    }}
  >
    {slice.points.map((point: any, idx: number) => (
      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 12,
            height: 12,
            background: point.serieColor,
            display: "inline-block",
            borderRadius: 2,
          }}
        />
        <span style={{ minWidth: 90, color: "#fff", fontWeight: 500 }}>
          {seriesLabels[idx] || `Series ${idx + 1}`}
        </span>
        <span style={{ fontWeight: 600, color: "#fff" }}>
          {Number(point.data.y).toFixed(2)}
        </span>
      </div>
    ))}
  </div>
);

// Accept location as a prop
export default function WeatherSummary({ location }: { location: Location }) {
  const [unit, setUnit] = useState<"C" | "F">("F");
  const [dateRange, setDateRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [allTimeMode, setAllTimeMode] = useState(false);

  // Set default date range on mount (last 30 days to today + 16 days)
  useEffect(() => {
    if (!dateRange) {
      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - 5);
      const startStr = start.toISOString().slice(0, 10);
      const end = new Date(today);
      end.setDate(today.getDate() + 16);
      const endStr = end.toISOString().slice(0, 10);
      setDateRange({ start: startStr, end: endStr });
    }
  }, [dateRange]);

  // Fetch weather data for selected location and date range
  const {
    data: weatherData,
    isLoading: weatherLoading,
    error: weatherError,
  } = useQuery<WeatherEntry[]>({
    queryKey: ["weather", location.id, dateRange, allTimeMode],
    queryFn: () => {
      if (allTimeMode) {
        return fetcher(`/api/v1/weather/location/${location.id}`);
      }
      if (dateRange) {
        return fetcher(
          `/api/v1/weather/location/${location.id}?start_date=${dateRange.start}&end_date=${dateRange.end}`
        );
      }
      return Promise.resolve([]);
    },
    enabled: !!location.id && (dateRange !== null || allTimeMode),
    staleTime: 5 * 60 * 1000,
  });

  // Prepare Nivo data
  const nivoData = useMemo(() => {
    if (!weatherData || !Array.isArray(weatherData)) return [];
    const minSeries: { x: string; y: number; isForecast: boolean }[] = [];
    const maxSeries: { x: string; y: number; isForecast: boolean }[] = [];
    weatherData.forEach((d) => {
      minSeries.push({
        x: d.date,
        y: unit === "C" ? d.temperature_min_c : d.temperature_min_f,
        isForecast: d.type === "forecast",
      });
      maxSeries.push({
        x: d.date,
        y: unit === "C" ? d.temperature_max_c : d.temperature_max_f,
        isForecast: d.type === "forecast",
      });
    });
    return [
      { id: "Min Temperature", data: minSeries },
      { id: "Max Temperature", data: maxSeries },
    ];
  }, [weatherData, unit]);

  // Responsive chart margins and x-axis ticks
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const chartMargin = isMobile
    ? { top: 20, right: 10, bottom: 50, left: 60 }
    : { top: 20, right: 30, bottom: 50, left: 60 };
  const axisFontSize = isMobile ? 10 : 13;

  // X-axis tick formatting and reduction for mobile and long ranges
  const xTickValues = useMemo(() => {
    if (!weatherData || !Array.isArray(weatherData)) return undefined;
    const dates = weatherData.map((d) => d.date);
    if (dates.length > 60) {
      // For very long ranges, every 14th date
      return dates.filter((_: string, i: number) => i % 14 === 0);
    } else if (dates.length > 30) {
      // For moderately long ranges, every 7th date
      return dates.filter((_: string, i: number) => i % 7 === 0);
    } else if (isMobile) {
      // For mobile, every 3rd date
      return dates.filter((_: string, i: number) => i % 3 === 0);
    }
    // Default: all dates
    return undefined;
  }, [weatherData, isMobile]);

  const xTickFormat = (d: string) => {
    if (!d) return d;
    const dateObj = parseISO(d);
    return isMobile ? format(dateObj, "MMM d") : format(dateObj, "yyyy-MM-dd");
  };

  return (
    <Card className="min-h-[400px] w-full shadow-lg bg-white dark:bg-gray-900 text-black dark:text-white mb-6">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <CardTitle className="text-2xl font-bold">Weather Summary</CardTitle>
        <div className="flex items-center gap-4">
          {/* Unit Toggle */}
          <Button
            variant={unit === "C" ? "default" : "outline"}
            size="sm"
            onClick={() => setUnit("C")}
          >
            °C
          </Button>
          <Button
            variant={unit === "F" ? "default" : "outline"}
            size="sm"
            onClick={() => setUnit("F")}
          >
            °F
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Location Selector and Date Range Picker */}
        <div className="mb-4 flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">Location:</span>
            <span className="font-medium">{location.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Date Range:</span>
            <div className="w-[260px]">
              <DateRangePopover
                dateRange={dateRange}
                setDateRange={setDateRange}
                onAllTime={() => {
                  setAllTimeMode(true);
                  setDateRange(null);
                }}
              />
            </div>
          </div>
        </div>
        {/* Chart */}
        {weatherLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading weather data...
          </div>
        ) : weatherError ? (
          <div className="py-8 text-center text-red-500">
            Error loading weather data: {weatherError.message}
          </div>
        ) : !nivoData ||
          nivoData.every((series) => series.data.length === 0) ? (
          <div className="py-8 text-center text-muted-foreground">
            No weather data found for this range.
          </div>
        ) : (
          <>
            {/* Move legend above chart on mobile for readability */}
            {isMobile && (
              <div className="flex flex-wrap gap-4 justify-center mb-2">
                {nivoData.map((series, i) => (
                  <div key={series.id} className="flex items-center gap-2">
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        background: [MIN_COLOR, MAX_COLOR][i],
                        display: "inline-block",
                        borderRadius: 2,
                      }}
                    />
                    <span
                      style={{
                        color: "var(--nivo-axis-text, #fff)",
                        fontSize: 13,
                      }}
                    >
                      {series.id}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="h-[350px] w-full">
              <ResponsiveLine
                data={nivoData}
                xScale={{ type: "point" }}
                yScale={{ type: "linear", min: "auto", max: "auto" }}
                axisBottom={{
                  tickRotation: isMobile ? -60 : -30,
                  tickValues: xTickValues,
                  format: xTickFormat,
                }}
                axisLeft={{
                  legend: `Temperature (°${unit})`,
                  legendOffset: -40,
                  legendPosition: "middle",
                }}
                margin={chartMargin}
                pointSize={8}
                enableSlices="x"
                theme={{
                  axis: {
                    ticks: {
                      text: {
                        fill: "var(--nivo-axis-text, #222)",
                        transition: "fill 0.2s",
                        fontSize: axisFontSize,
                      },
                    },
                    legend: {
                      text: {
                        fill: "var(--nivo-axis-text, #222)",
                        transition: "fill 0.2s",
                        fontSize: axisFontSize,
                      },
                    },
                  },
                  tooltip: {
                    container: { background: "#222", color: "#fff" },
                  },
                  grid: {
                    line: { stroke: "#444", strokeDasharray: "3 3" },
                  },
                }}
                colors={[MIN_COLOR, MAX_COLOR]}
                layers={[
                  "grid",
                  // Custom lines layer for dashed forecast segments
                  ({ series, lineGenerator, xScale, yScale }) => (
                    <g>
                      {series.map((serie) => {
                        const points = serie.data;
                        return points
                          .map((point, i) => {
                            if (i === 0) return null; // Skip first point
                            const prevPoint = points[i - 1];

                            // Type guard to ensure both points have valid data
                            if (
                              typeof point.data.y !== "number" ||
                              typeof prevPoint.data.y !== "number"
                            ) {
                              return null;
                            }

                            // Dashed if either endpoint is forecast
                            const isDashed =
                              (prevPoint.data as any).isForecast ||
                              (point.data as any).isForecast;

                            return (
                              <path
                                key={`${serie.id}-segment-${i}`}
                                d={
                                  lineGenerator([
                                    {
                                      x: xScale(prevPoint.data.x),
                                      y: yScale(prevPoint.data.y),
                                    },
                                    {
                                      x: xScale(point.data.x),
                                      y: yScale(point.data.y),
                                    },
                                  ]) || ""
                                }
                                fill="none"
                                stroke={serie.color}
                                strokeWidth={3}
                                strokeDasharray={isDashed ? "6,6" : ""}
                              />
                            );
                          })
                          .filter(Boolean); // Remove null values
                      })}
                    </g>
                  ),
                  "points",
                  "slices",
                  "axes",
                ]}
                sliceTooltip={CustomTooltip}
                lineWidth={3}
                pointSymbol={(props) => {
                  return (
                    <circle
                      r={props.size / 2}
                      fill={props.color}
                      stroke={props.borderColor}
                      strokeWidth={2}
                    />
                  );
                }}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

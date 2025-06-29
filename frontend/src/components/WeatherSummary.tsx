import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "../lib/fetcher";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ResponsiveLine } from "@nivo/line";
import DateRangePopover from "./DateRangePopover";
import { format, parseISO } from "date-fns";

const HIST_MAX_COLOR = "#2563eb";
const HIST_MIN_COLOR = "#60a5fa";
const MIN_COLOR = "#60a5fa"; // blue
const MAX_COLOR = "#f59e42"; // orange

// Types
interface Lawn {
  id: number;
  name: string;
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

interface NivoDatum {
  x: string;
  y: number;
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

export default function WeatherSummary() {
  const [selectedLawnId, setSelectedLawnId] = useState<string | undefined>(
    undefined
  );
  const [unit, setUnit] = useState<"C" | "F">("F");
  const [dateRange, setDateRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [autoDateRange, setAutoDateRange] = useState(true); // Track if user has set a custom range

  // Fetch lawns for dropdown
  const { data: lawns, isLoading: lawnsLoading } = useQuery<Lawn[]>({
    queryKey: ["lawns"],
    queryFn: () => fetcher("/api/v1/lawns/"),
    staleTime: 5 * 60 * 1000,
  });

  // Set default lawn on load
  useEffect(() => {
    if (selectedLawnId === undefined && lawns && lawns.length > 0) {
      setSelectedLawnId(String(lawns[0].id));
    }
  }, [lawns, selectedLawnId]);

  // Set default date range on mount (last 30 days to today + 16 days)
  useEffect(() => {
    if (!dateRange) {
      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - 10);
      const startStr = start.toISOString().slice(0, 10);
      // Set a wide end date initially; will adjust after data fetch
      const end = new Date(today);
      end.setDate(today.getDate() + 16);
      const endStr = end.toISOString().slice(0, 10);
      setDateRange({ start: startStr, end: endStr });
      setAutoDateRange(true);
    }
  }, [dateRange]);

  // Fetch weather data for selected lawn and date range
  const {
    data: weatherData,
    isLoading: weatherLoading,
    error: weatherError,
  } = useQuery<WeatherEntry[]>({
    queryKey: ["weather", selectedLawnId, dateRange],
    queryFn: () =>
      selectedLawnId !== undefined && dateRange
        ? fetcher(
            `/api/v1/weather/lawn/${selectedLawnId}?start_date=${dateRange.start}&end_date=${dateRange.end}`
          )
        : Promise.resolve([]),
    enabled: selectedLawnId !== undefined && !!dateRange,
    staleTime: 5 * 60 * 1000,
  });

  // After first weather data fetch, if autoDateRange is true, set end date to latest date in data
  useEffect(() => {
    if (autoDateRange && weatherData && weatherData.length > 0) {
      const latest = weatherData.reduce(
        (max, d) => (d.date > max ? d.date : max),
        weatherData[0].date
      );
      if (dateRange && latest > dateRange.end) {
        setDateRange({ start: dateRange.start, end: latest });
      }
      setAutoDateRange(false); // Only auto-set once
    }
  }, [weatherData, autoDateRange, dateRange]);

  // If user changes date range, turn off autoDateRange
  const handleSetDateRange = (range: { start: string; end: string } | null) => {
    setDateRange(range);
    setAutoDateRange(false);
  };

  // Prepare Nivo data
  const nivoData = useMemo(() => {
    if (!weatherData || !Array.isArray(weatherData)) return [];
    const minHist: { x: string; y: number | null }[] = [];
    const minFore: { x: string; y: number | null }[] = [];
    const maxHist: { x: string; y: number | null }[] = [];
    const maxFore: { x: string; y: number | null }[] = [];
    weatherData.forEach((d) => {
      const min = unit === "C" ? d.temperature_min_c : d.temperature_min_f;
      const max = unit === "C" ? d.temperature_max_c : d.temperature_max_f;
      if (d.type === "historical") {
        minHist.push({ x: d.date, y: min });
        minFore.push({ x: d.date, y: null });
        maxHist.push({ x: d.date, y: max });
        maxFore.push({ x: d.date, y: null });
      } else {
        minHist.push({ x: d.date, y: null });
        minFore.push({ x: d.date, y: min });
        maxHist.push({ x: d.date, y: null });
        maxFore.push({ x: d.date, y: max });
      }
    });
    return [
      { id: "Min Temperature (Historical)", data: minHist },
      { id: "Min Temperature (Forecast)", data: minFore },
      { id: "Max Temperature (Historical)", data: maxHist },
      { id: "Max Temperature (Forecast)", data: maxFore },
    ];
  }, [weatherData, unit]);

  // Responsive chart margins and x-axis ticks
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const chartMargin = isMobile
    ? { top: 20, right: 10, bottom: 75, left: 60 }
    : { top: 20, right: 30, bottom: 80, left: 60 };
  const axisFontSize = isMobile ? 10 : 13;

  // X-axis tick formatting and reduction for mobile
  const xTickValues = useMemo(() => {
    if (!weatherData || !Array.isArray(weatherData)) return undefined;
    const dates = weatherData.map((d) => d.date);
    if (!isMobile) return undefined; // default ticks
    // Show every 3rd date on mobile
    return dates.filter((_: string, i: number) => i % 3 === 0);
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
        {/* Lawn Selector and Date Range Picker */}
        <div className="mb-4 flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">Lawn:</span>
            {lawns && lawns.length > 0 && selectedLawnId !== undefined && (
              <Select
                value={selectedLawnId}
                onValueChange={setSelectedLawnId}
                disabled={lawnsLoading || !lawns}
              >
                <SelectTrigger className="w-64">
                  <SelectValue
                    placeholder={lawnsLoading ? "Loading..." : "Select a lawn"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {lawns.map((lawn: Lawn) => (
                    <SelectItem key={lawn.id} value={String(lawn.id)}>
                      {lawn.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Date Range:</span>
            <div className="w-[260px]">
              <DateRangePopover
                dateRange={dateRange}
                setDateRange={handleSetDateRange}
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
                colors={[MIN_COLOR, MIN_COLOR, MAX_COLOR, MAX_COLOR]}
                layers={[
                  "grid",
                  // Custom lines layer for dashed forecast segments
                  ({ series, lineGenerator, xScale, yScale }) => (
                    <g>
                      {series.map((serie) => {
                        const isForecast =
                          serie.id === "Min Temperature (Forecast)" ||
                          serie.id === "Max Temperature (Forecast)";
                        const points = serie.data;
                        let prev: (typeof points)[0] | null = null;
                        return points.map((point, i) => {
                          if (
                            typeof point.data.y !== "number" ||
                            prev === null ||
                            typeof prev.data.y !== "number"
                          ) {
                            prev = point;
                            return null;
                          }
                          const line = (
                            <path
                              key={`${serie.id}-segment-${i}`}
                              d={lineGenerator([
                                {
                                  x: xScale(prev.data.x),
                                  y: yScale(prev.data.y),
                                },
                                {
                                  x: xScale(point.data.x),
                                  y: yScale(point.data.y),
                                },
                              ])}
                              fill="none"
                              stroke={serie.color}
                              strokeWidth={3}
                              strokeDasharray={isForecast ? "6,6" : ""}
                            />
                          );
                          prev = point;
                          return line;
                        });
                      })}
                    </g>
                  ),
                  "points",
                  "slices",
                  "axes",
                  "legends",
                ]}
                legends={
                  isMobile
                    ? []
                    : [
                        {
                          anchor: "bottom",
                          direction: "row",
                          justify: false,
                          translateY: 80,
                          itemsSpacing: 8,
                          itemDirection: "left-to-right",
                          itemWidth: 180,
                          itemHeight: 20,
                          itemOpacity: 0.75,
                          symbolSize: 12,
                          symbolShape: "circle",
                          data: [
                            {
                              id: "Max Temperature (Historical)",
                              label: "Max Temp (Hist)",
                              color: MAX_COLOR,
                            },
                            {
                              id: "Max Temperature (Forecast)",
                              label: "Max Temp (Forecast)",
                              color: MAX_COLOR,
                            },
                            {
                              id: "Min Temperature (Historical)",
                              label: "Min Temp (Hist)",
                              color: MIN_COLOR,
                            },
                            {
                              id: "Min Temperature (Forecast)",
                              label: "Min Temp (Forecast)",
                              color: MIN_COLOR,
                            },
                          ],
                          effects: [
                            {
                              on: "hover",
                              style: {
                                itemBackground: "rgba(0, 0, 0, .03)",
                                itemOpacity: 1,
                              },
                            },
                          ],
                        },
                      ]
                }
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

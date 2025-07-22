import { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import DateRangePopover from "../DateRangePopover";
import { ResponsiveLine } from "@nivo/line";
import { format, parseISO } from "date-fns";
import { fetcher } from "../../lib/fetcher";
import { Location } from "../../types/location";
import { Info } from "lucide-react";
import { Button } from "../ui/button";

type WaterData = {
  id: number;
  date: string;
  location_id: number;
  et0_evapotranspiration_mm: number;
  et0_evapotranspiration_in: number;
  precipitation_mm: number;
  precipitation_in: number;
  relative_humidity_mean: number | null;
  type: string; // "historical" or "forecast"
};

interface WaterManagementSummaryProps {
  location: Location;
}

// Water balance zones - will be converted based on unit
const WATER_BALANCE_ZONES_MM = [
  {
    min: -20,
    max: -3,
    color: "#ef4444", // red
    label: "Turf needs water",
    description: "Significant irrigation needed",
    recommendation: "Water your lawn 1-2 times this week",
    icon: "💧",
    status: "needs-water",
  },
  {
    min: -3,
    max: -0.5,
    color: "#f97316", // orange
    label: "Monitor closely",
    description: "Some irrigation may be needed",
    recommendation: "Check soil moisture, water if needed",
    icon: "⚠️",
    status: "monitor",
  },
  {
    min: -0.5,
    max: 0.5,
    color: "#22c55e", // green
    label: "Turf is happy",
    description: "Natural precipitation meets turf needs",
    recommendation: "No irrigation needed",
    icon: "🌱",
    status: "happy",
  },
  {
    min: 0.5,
    max: 3,
    color: "#3b82f6", // blue
    label: "Too much water",
    description: "Excess moisture, reduce irrigation",
    recommendation: "Reduce or skip irrigation",
    icon: "🌧️",
    status: "surplus",
  },
  {
    min: 3,
    max: 20,
    color: "#1d4ed8", // dark blue
    label: "Excessive moisture",
    description: "Excessive moisture, potential issues",
    recommendation: "Avoid irrigation, monitor for disease",
    icon: "🚨",
    status: "excessive",
  },
];

function getWaterBalanceZone(
  balance: number,
  unit: "mm" | "in",
  isWeekly: boolean = false
) {
  // Convert zones based on unit (1 mm = 0.03937 inches)
  const conversionFactor = unit === "in" ? 0.03937 : 1;

  // For weekly calculations, multiply thresholds by 7 (7 days)
  const multiplier = isWeekly ? 7 : 1;

  const zones = WATER_BALANCE_ZONES_MM.map((zone) => ({
    ...zone,
    min: zone.min * conversionFactor * multiplier,
    max: zone.max * conversionFactor * multiplier,
  }));

  const foundZone = zones.find((b) => balance >= b.min && balance < b.max);
  return foundZone || zones[0]; // Default to red zone (needs water)
}

export default function WaterManagementSummary({
  location,
}: WaterManagementSummaryProps) {
  const [waterData, setWaterData] = useState<WaterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<"mm" | "in">("in");
  const [showDetails, setShowDetails] = useState(false);

  // Date range state: default to past 5 days and next 16 days (matching other charts)
  const today = new Date();
  const defaultStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 5);
    return d.toISOString().split("T")[0];
  }, [location.id]);
  const defaultEnd = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 16);
    return d.toISOString().split("T")[0];
  }, [location.id]);
  const [dateRange, setDateRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [allTimeMode, setAllTimeMode] = useState(false);

  // Compute start and end for API
  const startDate = dateRange?.start || defaultStart;
  const endDate = dateRange?.end || defaultEnd;

  useEffect(() => {
    if (!location) return;
    setLoading(true);
    setError(null);
    let url = `/api/v1/weather/location/${location.id}`;
    if (allTimeMode) {
      // No date parameters for all time
    } else {
      url += `?start_date=${startDate}&end_date=${endDate}`;
    }
    fetcher(url)
      .then((res) => setWaterData(res))
      .catch(() => setError("Failed to load water management data."))
      .finally(() => setLoading(false));
  }, [location, startDate, endDate, allTimeMode]);

  const chartData = useMemo(() => {
    const unitLabel = unit === "mm" ? "mm" : "in";
    return [
      {
        id: `ET0 (${unitLabel})`,
        color: "#f59e0b", // amber
        data: waterData.map((d) => ({
          x: d.date,
          y:
            unit === "mm"
              ? d.et0_evapotranspiration_mm
              : d.et0_evapotranspiration_in,
          isForecast: d.type === "forecast",
        })),
      },
      {
        id: `Precipitation (${unitLabel})`,
        color: "#3b82f6", // blue
        data: waterData.map((d) => ({
          x: d.date,
          y: unit === "mm" ? d.precipitation_mm : d.precipitation_in,
          isForecast: d.type === "forecast",
        })),
      },
      {
        id: `Water Balance (${unitLabel})`,
        color: "#22c55e", // green
        data: waterData.map((d) => ({
          x: d.date,
          y:
            (unit === "mm" ? d.precipitation_mm : d.precipitation_in) -
            (unit === "mm"
              ? d.et0_evapotranspiration_mm
              : d.et0_evapotranspiration_in),
          isForecast: d.type === "forecast",
        })),
      },
    ];
  }, [waterData, unit]);

  // Calculate current water balance
  const currentWaterBalance = useMemo(() => {
    if (!waterData || waterData.length === 0) return null;
    const today = new Date().toISOString().split("T")[0];
    const todayData = waterData.find((d) => d.date === today);
    if (!todayData) return null;
    const precip =
      unit === "mm" ? todayData.precipitation_mm : todayData.precipitation_in;
    const et0 =
      unit === "mm"
        ? todayData.et0_evapotranspiration_mm
        : todayData.et0_evapotranspiration_in;
    return precip - et0;
  }, [waterData, unit]);

  // Calculate 7-day water balance
  const weeklyWaterBalance = useMemo(() => {
    if (!waterData || waterData.length === 0) return null;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().split("T")[0];

    const recentData = waterData.filter((d) => d.date >= startDate);
    if (recentData.length === 0) return null;

    const totalPrecip = recentData.reduce(
      (sum, d) =>
        sum + (unit === "mm" ? d.precipitation_mm : d.precipitation_in),
      0
    );
    const totalET = recentData.reduce(
      (sum, d) =>
        sum +
        (unit === "mm"
          ? d.et0_evapotranspiration_mm
          : d.et0_evapotranspiration_in),
      0
    );
    return totalPrecip - totalET;
  }, [waterData, unit]);

  // Responsive chart margins
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const chartMargin = isMobile
    ? { top: 20, right: 10, bottom: 50, left: 60 }
    : { top: 20, right: 30, bottom: 50, left: 60 };
  const axisFontSize = isMobile ? 10 : 13;

  // X-axis tick formatting and reduction for mobile and long ranges
  const xTickValues = useMemo(() => {
    const dates = waterData.map((d) => d.date);
    if (dates.length > 60) {
      return dates.filter((_, i) => i % 14 === 0);
    } else if (dates.length > 30) {
      return dates.filter((_, i) => i % 7 === 0);
    } else if (isMobile) {
      return dates.filter((_, i) => i % 3 === 0);
    }
    return undefined;
  }, [waterData, isMobile]);

  const xTickFormat = (d: string) => {
    if (!d) return d;
    const dateObj = parseISO(d);
    return isMobile ? format(dateObj, "MMM d") : format(dateObj, "yyyy-MM-dd");
  };

  const CustomTooltip = ({ slice }: { slice: any }) => {
    if (!slice.points || slice.points.length === 0) return null;
    const point = slice.points[0];
    const date =
      typeof point.data.x === "string"
        ? format(parseISO(point.data.x), "MM/dd")
        : String(point.data.x);

    // Local function to get water balance zone (like Growth Potential and Weed Pressure)
    const getWaterBalanceZone = (balance: number, unit: "mm" | "in") => {
      if (unit === "mm") {
        // For mm, use the original zones
        return (
          WATER_BALANCE_ZONES_MM.find(
            (zone) => balance >= zone.min && balance < zone.max
          ) || WATER_BALANCE_ZONES_MM[0]
        );
      } else {
        // For inches, use the exact converted zones
        const zones = [
          {
            min: -0.393,
            max: -0.118,
            color: "#ef4444", // red
            label: "Turf needs water",
          },
          {
            min: -0.118,
            max: -0.02,
            color: "#f97316", // orange
            label: "Monitor closely",
          },
          {
            min: -0.02,
            max: 0.02,
            color: "#22c55e", // green
            label: "Turf is happy",
          },
          {
            min: 0.02,
            max: 0.118,
            color: "#3b82f6", // blue
            label: "Too much water",
          },
          {
            min: 0.118,
            max: 0.393,
            color: "#1d4ed8", // dark blue
            label: "Excessive moisture",
          },
        ];

        return (
          zones.find((zone) => balance >= zone.min && balance < zone.max) ||
          zones[0]
        );
      }
    };

    return (
      <div
        style={{
          background: "#222",
          color: "#fff",
          padding: 10,
          borderRadius: 8,
          fontSize: 14,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          minWidth: 250,
          maxWidth: 250,
          wordBreak: "break-word",
          border: "2px solid #444",
          pointerEvents: "none",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{date}</div>
        {slice.points.map((p: any) => {
          const value =
            typeof p.data.y === "number" ? p.data.y : Number(p.data.y);
          // Clean up the series names by removing the Nivo-added numbers
          const cleanName = p.id.replace(/\.\d+$/, ""); // Remove trailing .1, .2, .3, etc.

          // For water balance, color based on threshold zones
          let valueColor = p.color;
          if (cleanName.includes("Water Balance")) {
            const zone = getWaterBalanceZone(value, unit);
            valueColor = zone.color;
          }

          return (
            <div key={p.id} style={{ marginBottom: 2 }}>
              <div style={{ fontWeight: 600, color: valueColor }}>
                {cleanName}: {value.toFixed(unit === "mm" ? 1 : 3)} {unit}
              </div>
            </div>
          );
        })}
        <div style={{ color: "#aaa", marginTop: 4, fontSize: 12 }}>
          {slice.points.some((p: any) => p.data.isForecast)
            ? "Forecast"
            : "Historical"}
        </div>
      </div>
    );
  };

  const currentZone =
    currentWaterBalance !== null
      ? getWaterBalanceZone(currentWaterBalance, unit, false)
      : null;
  const weeklyZone =
    weeklyWaterBalance !== null
      ? getWaterBalanceZone(weeklyWaterBalance, unit, true)
      : null;

  // Calculate dynamic y-axis min and max
  const allYValues = useMemo(
    () => chartData.flatMap((series) => series.data.map((d) => d.y)),
    [chartData]
  );
  const yMin = allYValues.length ? Math.min(...allYValues) : 0;
  const yMax = allYValues.length ? Math.max(...allYValues) : 0;
  const yPadding = (yMax - yMin) * 0.1 || 1; // fallback to 1 if all values are the same
  const dynamicYMin = Math.floor(yMin - yPadding);
  const dynamicYMax = Math.ceil(yMax + yPadding);

  // Clamp y-axis to always include threshold bands
  const conversionFactor = unit === "in" ? 0.03937 : 1;
  const zoneMin = Math.min(
    ...WATER_BALANCE_ZONES_MM.map((z) => z.min * conversionFactor)
  );
  const zoneMax = Math.max(
    ...WATER_BALANCE_ZONES_MM.map((z) => z.max * conversionFactor)
  );
  const finalYMin = Math.min(dynamicYMin, Math.floor(zoneMin));
  const finalYMax = Math.max(dynamicYMax, Math.ceil(zoneMax));

  return (
    <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-2xl font-bold">Water Management</CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-pointer">
                <Info className="w-4 h-4 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-2">
                <div className="font-medium">Water Management Guide</div>
                <div className="text-sm">
                  <strong>ET0:</strong> How much water your grass needs daily
                </div>
                <div className="text-sm">
                  <strong>Precipitation:</strong> How much rain fell
                </div>
                <div className="text-sm">
                  <strong>Water Balance:</strong> Rain minus what grass needs
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  💧 = Needs water | 🌱 = Happy | ⚠️ = Monitor | 🌧️ = Too wet
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">Units:</span>
          <div className="flex border rounded-md">
            <Button
              variant={unit === "mm" ? "default" : "ghost"}
              size="sm"
              onClick={() => setUnit("mm")}
              className="rounded-r-none"
            >
              mm
            </Button>
            <Button
              variant={unit === "in" ? "default" : "ghost"}
              size="sm"
              onClick={() => setUnit("in")}
              className="rounded-l-none"
            >
              in
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col md:flex-row items-center gap-4">
          <span className="font-medium">Date Range:</span>
          <div className="w-full md:w-[260px]">
            <DateRangePopover
              dateRange={dateRange}
              setDateRange={setDateRange}
              onAllTime={() => setAllTimeMode(true)}
              allTimeMode={allTimeMode}
            />
          </div>
        </div>
        {loading ? (
          <div className="h-[350px] flex items-center justify-center">
            Loading water management data...
          </div>
        ) : error ? (
          <div className="h-[350px] flex items-center justify-center text-red-500">
            {error}
          </div>
        ) : (
          <>
            <div className="h-[350px] w-full">
              <ResponsiveLine
                data={chartData}
                xScale={{ type: "point" }}
                yScale={{
                  type: "linear",
                  min: finalYMin,
                  max: finalYMax,
                }}
                axisBottom={{
                  tickRotation: isMobile ? -60 : -30,
                  tickValues: xTickValues,
                  format: xTickFormat,
                }}
                axisLeft={{
                  legend: unit,
                  legendOffset: -50,
                  legendPosition: "middle",
                }}
                margin={chartMargin}
                pointSize={8}
                enableSlices="x"
                theme={{
                  axis: {
                    ticks: {
                      text: {
                        fill: "var(--nivo-axis-text, #cbd5e1)",
                        transition: "fill 0.2s",
                        fontSize: axisFontSize,
                      },
                    },
                    legend: {
                      text: {
                        fill: "var(--nivo-axis-text, #cbd5e1)",
                        transition: "fill 0.2s",
                        fontSize: axisFontSize,
                      },
                    },
                    domain: { line: { stroke: "#cbd5e1", strokeWidth: 2 } },
                  },
                  tooltip: {
                    container: { background: "#222", color: "#fff" },
                  },
                  grid: {
                    line: { stroke: "#444", strokeDasharray: "3 3" },
                  },
                }}
                colors={(d) => d.color}
                layers={[
                  // Background water balance zones
                  ({ yScale, innerWidth }) => {
                    // Convert zones based on unit
                    const conversionFactor = unit === "in" ? 0.03937 : 1;
                    const zones = WATER_BALANCE_ZONES_MM.map((zone) => ({
                      ...zone,
                      min: zone.min * conversionFactor,
                      max: zone.max * conversionFactor,
                    }));

                    // Extend the first and last zone to the y-axis min/max
                    if (zones.length > 0) {
                      zones[0].min = finalYMin;
                      zones[zones.length - 1].max = finalYMax;
                    }

                    return (
                      <g>
                        {zones.map((zone) => {
                          const y1 = yScale(zone.max);
                          const y2 = yScale(zone.min);
                          return (
                            <rect
                              key={zone.label}
                              x={0}
                              y={y1}
                              width={innerWidth}
                              height={y2 - y1}
                              fill={zone.color}
                              opacity={0.15}
                            />
                          );
                        })}
                      </g>
                    );
                  },
                  "grid",
                  // Custom lines layer for dashed forecast segments
                  ({ series, lineGenerator, xScale, yScale }) => (
                    <g>
                      {series.map((serie) => {
                        const points = serie.data;
                        const color = serie.color;
                        return points
                          .map((point, i) => {
                            if (i === 0) return null; // Skip first point
                            const prevPoint = points[i - 1];
                            if (
                              typeof point.data.y !== "number" ||
                              typeof prevPoint.data.y !== "number"
                            ) {
                              return null;
                            }
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
                                stroke={color}
                                strokeWidth={3}
                                strokeDasharray={isDashed ? "6,6" : ""}
                              />
                            );
                          })
                          .filter(Boolean);
                      })}
                    </g>
                  ),
                  "points",
                  "slices",
                  "axes",
                ]}
                sliceTooltip={CustomTooltip}
                lineWidth={3}
              />
            </div>

            {/* Current water balance summary */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-lg font-semibold">
                  Today's Water Balance
                </div>
                {currentWaterBalance !== null ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{currentZone?.icon}</div>
                      <div className="flex-1">
                        <div
                          className="text-2xl font-bold"
                          style={{ color: currentZone?.color }}
                        >
                          {currentZone?.label}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {currentZone?.recommendation}
                        </div>
                      </div>
                    </div>
                    {showDetails && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <div className="font-medium">Technical Details:</div>
                        <div>
                          Balance: {currentWaterBalance > 0 ? "+" : ""}
                          {currentWaterBalance.toFixed(
                            unit === "mm" ? 1 : 3
                          )}{" "}
                          {unit}
                        </div>
                        <div>{currentZone?.description}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-muted-foreground">No data for today</div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-lg font-semibold">7-Day Water Balance</div>
                {weeklyWaterBalance !== null ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{weeklyZone?.icon}</div>
                      <div className="flex-1">
                        <div
                          className="text-2xl font-bold"
                          style={{ color: weeklyZone?.color }}
                        >
                          {weeklyZone?.label}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {weeklyZone?.recommendation}
                        </div>
                      </div>
                    </div>
                    {showDetails && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <div className="font-medium">Technical Details:</div>
                        <div>
                          Balance: {weeklyWaterBalance > 0 ? "+" : ""}
                          {weeklyWaterBalance.toFixed(
                            unit === "mm" ? 1 : 3
                          )}{" "}
                          {unit}
                        </div>
                        <div>{weeklyZone?.description}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-muted-foreground">Insufficient data</div>
                )}
              </div>
            </div>

            {/* Show/Hide Details Toggle */}
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? "Hide Details" : "Show Details"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

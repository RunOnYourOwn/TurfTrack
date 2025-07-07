import { useEffect, useState, useMemo } from "react";
import { Location } from "../../types/location";
import { DiseasePressureList } from "../../types/disease-pressure";
import { diseasePressureApi } from "../../lib/diseasePressureApi";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from "lucide-react";
import { ResponsiveLine } from "@nivo/line";
import { format, parseISO } from "date-fns";
import DateRangePopover from "../DateRangePopover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DiseasePressureSummaryProps {
  location: Location;
}

const getTrend = (data: DiseasePressureList[]) => {
  if (data.length < 2) return "stable";

  // Filter out null values for trend calculation
  const validData = data.filter((item) => item.risk_score !== null);
  if (validData.length < 2) return "stable";

  const recent = validData.slice(-3); // Last 3 days
  const avg =
    recent.reduce((sum, item) => sum + (item.risk_score || 0), 0) /
    recent.length;
  const previous = validData.slice(-6, -3); // 3 days before that
  if (previous.length === 0) return "stable";
  const prevAvg =
    previous.reduce((sum, item) => sum + (item.risk_score || 0), 0) /
    previous.length;

  if (avg > prevAvg + 0.1) return "increasing";
  if (avg < prevAvg - 0.1) return "decreasing";
  return "stable";
};

const LINE_COLOR = "#f59e42"; // orange, matches WeatherSummary

const RISK_BANDS = [
  {
    min: 0,
    max: 20,
    color: "#7fc97f",
    label: "Low risk, prepare for preventive applications",
  },
  {
    min: 20,
    max: 30,
    color: "#ffe066",
    label: "Moderate risk, preventive fungicide applications necessary",
  },
  {
    min: 30,
    max: 50,
    color: "#ffb347",
    label:
      "Elevated risk, continue preventive applications on prescribed intervals",
  },
  {
    min: 50,
    max: 100,
    color: "#ff4d4f",
    label:
      "High risk, consider tightened intervals, tank-mixtures, or increased rates to bolster protection",
  },
];

function getRiskBand(risk: number) {
  return (
    RISK_BANDS.find((b) => risk >= b.min && risk < b.max) ||
    RISK_BANDS[RISK_BANDS.length - 1]
  );
}

export default function DiseasePressureSummary({
  location,
}: DiseasePressureSummaryProps) {
  const [diseaseData, setDiseaseData] = useState<DiseasePressureList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range state: default to past 5 days and next 16 days
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
    setLoading(true);
    setError(null);
    let fetchPromise;
    if (allTimeMode) {
      fetchPromise = diseasePressureApi.getForLocation(location.id);
    } else {
      fetchPromise = diseasePressureApi.getForLocation(location.id, {
        start_date: startDate,
        end_date: endDate,
      });
    }
    fetchPromise
      .then((data) => {
        setDiseaseData(data);
      })
      .catch((err) => {
        setError("Failed to load disease pressure data");
        console.error("Disease pressure error:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [location.id, startDate, endDate, allTimeMode]);

  // Handler for All Time
  const handleAllTime = () => {
    setAllTimeMode(true);
    setDateRange(null);
  };
  // Handler for date range change
  const handleDateRange = (range: { start: string; end: string } | null) => {
    setDateRange(range);
    setAllTimeMode(false);
  };

  // Only show Smith-Kerns (dollar_spot) chart, past 5 historical + all forecast
  const smithKernsData = useMemo(
    () =>
      diseaseData.filter(
        (d) => d.disease === "smith_kerns" || d.disease === "dollar_spot"
      ),
    [diseaseData]
  );
  const chartData = useMemo(
    () => [
      {
        id: "Smith-Kerns Dollar Spot",
        data: smithKernsData
          .filter(
            (d): d is DiseasePressureList & { risk_score: number } =>
              d.risk_score !== null
          ) // Filter out pending data points
          .map((d) => ({
            x: d.date,
            y: d.risk_score * 100,
            isForecast: d.is_forecast,
          })),
      },
    ],
    [smithKernsData]
  );

  // Separate pending data for display
  const pendingData = useMemo(
    () => smithKernsData.filter((d) => d.risk_score === null),
    [smithKernsData]
  );

  // Responsive chart margins and x-axis ticks
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const chartMargin = isMobile
    ? { top: 20, right: 10, bottom: 50, left: 60 }
    : { top: 20, right: 30, bottom: 50, left: 60 };
  const axisFontSize = isMobile ? 10 : 13;

  // X-axis tick formatting and reduction for mobile and long ranges
  const xTickValues = useMemo(() => {
    const dates = smithKernsData.map((d) => d.date);
    if (dates.length > 60) {
      return dates.filter((_, i) => i % 14 === 0);
    } else if (dates.length > 30) {
      return dates.filter((_, i) => i % 7 === 0);
    } else if (isMobile) {
      return dates.filter((_, i) => i % 3 === 0);
    }
    return undefined;
  }, [smithKernsData, isMobile]);

  const xTickFormat = (d: string) => {
    if (!d) return d;
    const dateObj = parseISO(d);
    return isMobile ? format(dateObj, "MMM d") : format(dateObj, "yyyy-MM-dd");
  };

  // Custom tooltip for Nivo
  const CustomTooltip = ({ slice }: { slice: any }) => {
    if (!slice.points || slice.points.length === 0) return null;
    const point = slice.points[0];
    const riskValue =
      typeof point.data.y === "number" ? point.data.y : Number(point.data.y);
    const band = getRiskBand(riskValue);
    return (
      <div
        style={{
          background: "#222",
          color: "#fff",
          padding: 10,
          borderRadius: 8,
          fontSize: 14,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          minWidth: 110,
          border: "2px solid #444",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 2 }}>
          {typeof point.data.x === "string"
            ? format(parseISO(point.data.x), "MM/dd")
            : String(point.data.x)}
        </div>
        <div style={{ fontWeight: 600, color: band.color }}>
          Risk %: {riskValue.toFixed(1)}
        </div>
        <div style={{ color: "#aaa", marginTop: 2 }}>
          {slice.points.some((p: any) => p.data.isForecast)
            ? "Forecast"
            : "Historical"}
        </div>
      </div>
    );
  };

  // Get current risk and trend for Smith-Kerns
  const smithKernsTrend = getTrend(smithKernsData);

  if (loading) {
    return (
      <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader>
          <CardTitle>Disease Pressure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">
            Loading disease pressure data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader>
          <CardTitle>Disease Pressure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <CardTitle className="text-2xl font-bold">Disease Pressure</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Date Range Picker */}
        <div className="mb-4 flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">Date Range:</span>
            <div className="w-[260px]">
              <DateRangePopover
                dateRange={dateRange}
                setDateRange={handleDateRange}
                onAllTime={handleAllTime}
                allTimeMode={allTimeMode}
              />
            </div>
          </div>
        </div>
        <div className="space-y-8">
          {/* Smith-Kerns Dollar Spot Chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium flex items-center gap-1">
                Smith-Kerns Dollar Spot
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start">
                    <>
                      Smith-Kerns Dollar Spot risk quantifies the probability of
                      dollar spot disease development
                      <br />
                      based on weather and model parameters.
                      <br />
                      Higher values indicate greater risk and need for
                      preventive fungicide applications.
                    </>
                  </TooltipContent>
                </Tooltip>
              </h3>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveLine
                data={chartData}
                xScale={{ type: "point" }}
                yScale={{ type: "linear", min: 0, max: 100 }}
                axisBottom={{
                  tickRotation: isMobile ? -60 : -30,
                  tickValues: xTickValues,
                  format: xTickFormat,
                }}
                axisLeft={{
                  legend: "Risk %",
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
                colors={[LINE_COLOR]}
                layers={[
                  // Background risk bands layer
                  ({ yScale, innerWidth }) => (
                    <g>
                      {RISK_BANDS.map((band) => {
                        const y1 = yScale(band.max);
                        const y2 = yScale(band.min);
                        return (
                          <rect
                            key={band.label}
                            x={0}
                            y={y1}
                            width={innerWidth}
                            height={y2 - y1}
                            fill={band.color}
                            opacity={0.22}
                          />
                        );
                      })}
                    </g>
                  ),
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
                                stroke={LINE_COLOR}
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
                pointSymbol={(props) => (
                  <circle
                    r={props.size / 2}
                    fill={props.color}
                    stroke={props.borderColor}
                    strokeWidth={2}
                  />
                )}
              />
            </div>
            {/** Show today's risk and message below chart **/}
            {(() => {
              // Find today's risk value using local date
              const todayStr = format(new Date(), "yyyy-MM-dd");
              const todayData = smithKernsData.find((d) => d.date === todayStr);
              const todayRisk =
                todayData && todayData.risk_score !== null
                  ? todayData.risk_score * 100
                  : null;
              const band = todayRisk !== null ? getRiskBand(todayRisk) : null;
              return (
                <div className="space-y-1 mt-2">
                  <div className="text-2xl font-bold">
                    {todayRisk !== null ? todayRisk.toFixed(1) + "%" : "—"}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    {smithKernsTrend === "increasing" && (
                      <TrendingUp className="h-4 w-4 text-orange-500" />
                    )}
                    {smithKernsTrend === "decreasing" && (
                      <TrendingDown className="h-4 w-4 text-green-500" />
                    )}
                    {smithKernsTrend === "stable" && (
                      <Minus className="h-4 w-4 text-gray-500" />
                    )}
                    <span className="capitalize">{smithKernsTrend}</span>
                  </div>
                  {band && (
                    <div className="mt-1 text-xs font-semibold text-black dark:text-yellow-300">
                      {band.label}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Show pending data indicator if there are any */}
            {pendingData.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="font-medium text-yellow-800 dark:text-yellow-200">
                    Pending Data
                  </span>
                </div>
                <div className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                  Disease pressure calculation pending for {pendingData.length}{" "}
                  day{pendingData.length > 1 ? "s" : ""} due to incomplete
                  weather data. This will be updated when weather data becomes
                  available.
                </div>
                <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                  Pending dates:{" "}
                  {pendingData
                    .map((d) => format(parseISO(d.date), "MMM d"))
                    .join(", ")}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import DateRangePopover from "../DateRangePopover";
import { ResponsiveLine } from "@nivo/line";
import { format, parseISO } from "date-fns";
import { fetcher } from "../../lib/fetcher";
import { Location } from "../../types/location";
import { Info } from "lucide-react";
import Select from "react-select";
import { selectStyles } from "../../lib/selectStyles";

const LINE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444"];

// Growth potential types (field, label)
const GROWTH_POTENTIAL_TYPES = [
  { field: "growth_potential", label: "Raw" },
  { field: "gp_3d_avg", label: "3-day Average" },
  { field: "gp_5d_avg", label: "5-day Average" },
  { field: "gp_7d_avg", label: "7-day Average" },
];

type GrowthPotential = {
  id: number;
  date: string;
  location_id: number;
  growth_potential: number | null;
  gp_3d_avg: number | null;
  gp_5d_avg: number | null;
  gp_7d_avg: number | null;
  created_at: string;
  is_forecast: boolean;
};

interface GrowthPotentialSummaryProps {
  location: Location;
}

// Growth potential bands (with management recommendations)
const GROWTH_BANDS = [
  {
    min: 80,
    max: 100.1, // allow 100% to be included
    color: "#2e8b57", // green
    label: "Optimal growth",
    description: "Excellent conditions for shoot and root development.",
    recommendation: "Aggressive management OK (topdressing, verticutting)",
    detailedRecommendation: `Aggressive management is possible: aerification, verticutting, topdressing, and overseeding can be performed with minimal risk.\nFertilizer applications will be highly effective; consider split applications for sustained growth.\nIrrigation can be reduced if rainfall is adequate.\nMonitor for rapid thatch accumulation and increased mowing frequency.`,
  },
  {
    min: 50,
    max: 80,
    color: "#ffe066", // yellow
    label: "Moderate growth",
    description:
      "Turf is growing, but not at peak potential; may need adjusted fertility or irrigation.",
    recommendation: "Normal maintenance (mowing, light fert)",
    detailedRecommendation: `Maintain regular mowing and fertility programs.\nLight topdressing and grooming are appropriate.\nMonitor for disease pressure, as lush growth can increase susceptibility.\nAdjust irrigation based on evapotranspiration rates.`,
  },
  {
    min: 20,
    max: 50,
    color: "#ffb347", // orange
    label: "Low growth",
    description: "Growth is slow; stress conditions may be present.",
    recommendation: "Caution zone (monitor water/stress)",
    detailedRecommendation: `Avoid aggressive cultural practices (aerification, heavy topdressing).\nFocus on stress reduction: raise mowing height, reduce traffic, and avoid overwatering.\nApply light, balanced fertilizer only if deficiency symptoms are present.\nMonitor for signs of drought or heat stress.`,
  },
  {
    min: 0,
    max: 20,
    color: "#ff4d4f", // red
    label: "Dormant or severely limited",
    description: "Turf is under significant stress; minimal to no growth.",
    recommendation: "Recovery mode or dormancy (limit activity)",
    detailedRecommendation: `Suspend most maintenance activities; avoid fertilization and aggressive practices.\nLimit traffic and mowing to prevent turf injury.\nIrrigate only to prevent severe desiccation (if allowed by local regulations).\nPlan for recovery practices once growth potential increases.`,
  },
];

function getGrowthBand(growth: number) {
  return (
    GROWTH_BANDS.find((b) => growth >= b.min && growth < b.max) ||
    GROWTH_BANDS[GROWTH_BANDS.length - 1]
  );
}

export default function GrowthPotentialSummary({
  location,
}: GrowthPotentialSummaryProps) {
  const [growthData, setGrowthData] = useState<GrowthPotential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Growth potential type selection state (default to raw)
  const [selectedGrowthTypes, setSelectedGrowthTypes] = useState<string[]>([
    "growth_potential",
  ]);

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
    if (!location) return;
    setLoading(true);
    setError(null);
    let url = `/api/v1/growth_potential/?location_id=${location.id}`;
    if (allTimeMode) {
      // No date parameters for all time
    } else {
      url += `&start_date=${startDate}&end_date=${endDate}`;
    }
    fetcher(url)
      .then((res) => setGrowthData(res))
      .catch(() => setError("Failed to load growth potential data."))
      .finally(() => setLoading(false));
  }, [location, startDate, endDate, allTimeMode]);

  const chartData = useMemo(() => {
    return selectedGrowthTypes.map((type) => {
      const typeConfig = GROWTH_POTENTIAL_TYPES.find((t) => t.field === type);
      // Find the fixed color index for this growth type
      const colorIndex = GROWTH_POTENTIAL_TYPES.findIndex(
        (t) => t.field === type
      );
      return {
        id: typeConfig ? typeConfig.label : type,
        color: LINE_COLORS[colorIndex % LINE_COLORS.length],
        data: growthData.map((d) => ({
          x: d.date,
          y:
            d[type as keyof GrowthPotential] !== null
              ? (d[type as keyof GrowthPotential] as number) * 100
              : null,
          isForecast: d.is_forecast,
        })),
      };
    });
  }, [growthData, selectedGrowthTypes]);

  // Responsive chart margins and x-axis ticks
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const chartMargin = isMobile
    ? { top: 20, right: 10, bottom: 50, left: 60 }
    : { top: 20, right: 30, bottom: 50, left: 60 };
  const axisFontSize = isMobile ? 10 : 13;

  // X-axis tick formatting and reduction for mobile and long ranges
  const xTickValues = useMemo(() => {
    const dates = growthData.map((d) => d.date);
    if (dates.length > 60) {
      return dates.filter((_, i) => i % 14 === 0);
    } else if (dates.length > 30) {
      return dates.filter((_, i) => i % 7 === 0);
    } else if (isMobile) {
      return dates.filter((_, i) => i % 3 === 0);
    }
    return undefined;
  }, [growthData, isMobile]);

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

    return (
      <div
        style={{
          background: "#222",
          color: "#fff",
          padding: 10,
          borderRadius: 8,
          fontSize: 14,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          minWidth: 200,
          maxWidth: 200,
          wordBreak: "break-word",
          border: "2px solid #444",
          pointerEvents: "none",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{date}</div>
        {slice.points.map((p: any) => {
          const growthValue =
            typeof p.data.y === "number" ? p.data.y : Number(p.data.y);
          const band = getGrowthBand(growthValue);
          // Get the correct label from our GROWTH_POTENTIAL_TYPES array
          const typeConfig = GROWTH_POTENTIAL_TYPES.find(
            (t) => t.label === p.id || p.id.startsWith(t.label)
          );
          const displayLabel = typeConfig ? typeConfig.label : p.id;
          return (
            <div key={p.id} style={{ marginBottom: 2 }}>
              <div style={{ fontWeight: 600, color: band.color }}>
                {displayLabel}: {growthValue.toFixed(1)}%
              </div>
              <div style={{ color: "#aaa", fontSize: 12 }}>{band.label}</div>
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

  // Find today's growth values using local date
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayData = growthData.find((d) => d.date === todayStr);
  const latestData =
    todayData ||
    (growthData.length > 0 ? growthData[growthData.length - 1] : null);

  // Get current values for selected growth types
  const currentValues = selectedGrowthTypes.map((type) => {
    if (!latestData) return null;
    const value = latestData[type as keyof GrowthPotential];
    return value !== null ? (value as number) * 100 : null;
  });

  // Use the first selected type for the main display
  const todayGrowth = currentValues[0];
  const band = todayGrowth !== null ? getGrowthBand(todayGrowth) : null;

  return (
    <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-2xl font-bold">Growth Potential</CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-pointer">
                <Info className="w-4 h-4 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Growth potential (GP) quantifies how favorable temperatures are
              for turfgrass growth (0-1 scale).
              <br />
              Calculated from daily average temperature and grass type.
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col md:flex-row items-center gap-4">
          <span className="font-medium">Date Range:</span>
          <div className="w-full md:w-[260px]">
            <DateRangePopover
              dateRange={dateRange}
              setDateRange={(range) => {
                setDateRange(range);
                setAllTimeMode(false);
              }}
              onAllTime={() => {
                setAllTimeMode(true);
                setDateRange(null);
              }}
              allTimeMode={allTimeMode}
            />
          </div>
          <span className="font-medium">Growth Types:</span>
          <div className="w-full md:w-[320px] lg:w-[400px]">
            <Select
              isMulti
              options={GROWTH_POTENTIAL_TYPES.map((type) => ({
                value: type.field,
                label: type.label,
              }))}
              value={GROWTH_POTENTIAL_TYPES.filter((type) =>
                selectedGrowthTypes.includes(type.field)
              ).map((type) => ({ value: type.field, label: type.label }))}
              onChange={(opts) =>
                setSelectedGrowthTypes(opts.map((o: any) => o.value))
              }
              classNamePrefix="react-select"
              styles={selectStyles}
              menuPlacement="auto"
              placeholder="Select growth types..."
            />
          </div>
        </div>
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            Loading...
          </div>
        ) : error ? (
          <div className="h-48 flex items-center justify-center text-red-500">
            {error}
          </div>
        ) : growthData.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            No data available.
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Growth Potential</h3>
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
                  legend: "Growth %",
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
                colors={(d) => d.color}
                layers={[
                  // Background growth bands layer
                  ({ yScale, innerWidth }) => (
                    <g>
                      {GROWTH_BANDS.map((band) => {
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
            {/* Show today's growth and message below chart */}
            <div className="space-y-1 mt-2">
              {selectedGrowthTypes.length === 1 ? (
                // Single type display
                <>
                  <div className="text-2xl font-bold">
                    {todayGrowth !== null ? todayGrowth.toFixed(1) + "%" : "—"}
                  </div>
                  {band && (
                    <div className="mt-1 text-xs font-semibold text-black dark:text-yellow-300">
                      {band.label}
                    </div>
                  )}
                  {band && (
                    <div className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                      {band.recommendation}
                    </div>
                  )}
                  {band && (
                    <div className="mt-1 text-xs text-muted-foreground whitespace-pre-line">
                      {band.detailedRecommendation}
                    </div>
                  )}
                </>
              ) : (
                // Multiple types display
                <div className="space-y-2">
                  <div className="text-lg font-bold">Current Values:</div>
                  {selectedGrowthTypes.map((type, index) => {
                    const value = currentValues[index];
                    const typeConfig = GROWTH_POTENTIAL_TYPES.find(
                      (t) => t.field === type
                    );
                    const valueBand =
                      value !== null ? getGrowthBand(value) : null;

                    return (
                      <div key={type} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: valueBand
                              ? valueBand.color
                              : "#666",
                          }}
                        />
                        <span className="font-medium">
                          {typeConfig?.label}:{" "}
                          {value !== null ? value.toFixed(1) + "%" : "—"}
                        </span>
                        {valueBand && (
                          <span className="text-xs text-muted-foreground">
                            ({valueBand.label})
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {band && (
                    <div className="mt-2 text-xs text-muted-foreground whitespace-pre-line">
                      {band.detailedRecommendation}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import React, { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Info } from "lucide-react";
import { fetchWeedSpecies } from "../../lib/weedPressureApi";
import { WeedSpecies } from "../../types/weed-pressure";
import { ResponsiveLine } from "@nivo/line";
import { nivoTheme, nivoColors } from "../../lib/nivoTheme";
import Select from "react-select";
import DateRangePopover from "../DateRangePopover";
import { selectStyles } from "../../lib/selectStyles";
import { fetcher } from "../../lib/fetcher";

// Define weed pressure bands (example values)
const PRESSURE_BANDS = [
  { min: 7.5, max: 10, color: "#ff4d4f", label: "Very High" },
  { min: 5, max: 7.5, color: "#ffb347", label: "High" },
  { min: 2, max: 5, color: "#ffe066", label: "Moderate" },
  { min: 0, max: 2, color: "#2e8b57", label: "Low" },
];

interface Props {
  locationId: number;
  defaultStartDate?: string;
  defaultEndDate?: string;
}

function getDefaultDateRange() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 5);
  const end = new Date(today);
  end.setDate(today.getDate() + 16);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

// Add type for flat weed pressure data
type WeedPressureFlatData = {
  date: string;
  species_id: number;
  species_name: string;
  common_name: string;
  pressure_score: number;
  gdd_accumulated?: number;
  is_forecast: boolean;
};

// Helper functions for weed pressure status and recommendations
function getWeedPressureStatus(score: number): {
  label: string;
  color: string;
} {
  if (score >= 7.5) return { label: "Very High Pressure", color: "#ff4d4f" };
  if (score >= 5) return { label: "High Pressure", color: "#ffb347" };
  if (score >= 2) return { label: "Moderate Pressure", color: "#ffe066" };
  return { label: "Low Pressure", color: "#2e8b57" };
}

function getWeedPressureRecommendations(score: number): string[] {
  if (score >= 8) {
    return [
      "Immediate herbicide application recommended",
      "Monitor for rapid weed growth",
      "Consider pre-emergent if not already applied",
    ];
  } else if (score >= 5) {
    return [
      "Plan herbicide application within 1-2 weeks",
      "Monitor weather conditions for optimal timing",
      "Check soil moisture before application",
    ];
  } else if (score >= 3) {
    return [
      "Continue monitoring weed development",
      "Prepare for potential herbicide application",
      "Maintain healthy turf to suppress weeds",
    ];
  } else {
    return [
      "Minimal weed pressure - focus on turf health",
      "Continue regular maintenance practices",
      "Monitor for changes in conditions",
    ];
  }
}

export const WeedPressureChart: React.FC<Props> = ({
  locationId,
  defaultStartDate,
  defaultEndDate,
}) => {
  const initialRange = useMemo(
    () =>
      defaultStartDate && defaultEndDate
        ? { start: defaultStartDate, end: defaultEndDate }
        : getDefaultDateRange(),
    [defaultStartDate, defaultEndDate]
  );
  const [species, setSpecies] = useState<WeedSpecies[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<number[]>([]);
  const [dateRange, setDateRange] = useState<{
    start: string;
    end: string;
  } | null>(initialRange);
  const [allTimeMode, setAllTimeMode] = useState(false);
  const [chartData, setChartData] = useState<WeedPressureFlatData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchWeedSpecies().then(setSpecies);
  }, []);

  useEffect(() => {
    if (!species.length) return;
    setSelectedSpecies(species.map((s) => s.id));
  }, [species]);

  useEffect(() => {
    if (!selectedSpecies.length) return;
    setLoading(true);

    let url = `/api/v1/weed-pressure/location/${locationId}/chart-flat?include_forecast=true`;

    if (!allTimeMode && dateRange) {
      url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
    }

    if (selectedSpecies.length > 0) {
      url += `&species_ids=${selectedSpecies.join(",")}`;
    }

    fetcher(url)
      .then(setChartData)
      .finally(() => setLoading(false));
  }, [locationId, dateRange, selectedSpecies, allTimeMode]);

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

  const chartLines = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];

    // Group data by species (common_name) like growth potential groups by type
    const speciesGroups = chartData.reduce(
      (
        groups: Record<string, WeedPressureFlatData[]>,
        item: WeedPressureFlatData
      ) => {
        const key = item.common_name;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(item);
        return groups;
      },
      {}
    );

    // Create chart series from grouped data
    const lines = Object.entries(speciesGroups).map(
      ([speciesName, items]: [string, WeedPressureFlatData[]], index) => {
        const filteredData = items
          .filter(
            (item: WeedPressureFlatData) =>
              typeof item.pressure_score === "number" &&
              !isNaN(item.pressure_score) &&
              item.pressure_score !== null &&
              item.pressure_score !== undefined &&
              item.date && // Ensure date exists
              typeof item.date === "string" // Ensure date is string
          )
          .map((item: WeedPressureFlatData) => ({
            x: item.date,
            y: Number(item.pressure_score), // Ensure y is a number
            isForecast: !!item.is_forecast,
          }))
          .sort(
            (a: any, b: any) =>
              new Date(a.x).getTime() - new Date(b.x).getTime()
          )
          .filter(
            (item: any) =>
              // Additional validation to ensure x and y are valid
              item.x &&
              typeof item.x === "string" &&
              !isNaN(item.y) &&
              typeof item.y === "number"
          );

        return {
          id: speciesName,
          color: nivoColors[index % nivoColors.length],
          data: filteredData,
        };
      }
    );

    // Debug: check for duplicate series IDs
    if (typeof window !== "undefined") {
      const ids = lines.map((line) => line.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        // eslint-disable-next-line no-console
        console.warn("WeedPressureChart: Duplicate series IDs found:", ids);
      }
    }

    return lines;
  }, [chartData]);

  // Calculate current status from flat data
  const currentStatus = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;

    // Use local date instead of UTC to match user's timezone
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD format
    const todayData = chartData.filter((item) => item.date === today);

    if (todayData.length === 0) return null;

    const highestPressure = Math.max(
      ...todayData.map((item) => item.pressure_score)
    );
    const highestSpecies = todayData.find(
      (item) => item.pressure_score === highestPressure
    );

    return {
      highest_pressure: highestPressure,
      status: getWeedPressureStatus(highestPressure),
      recommendations: getWeedPressureRecommendations(highestPressure),
      species_name: highestSpecies?.common_name || "Unknown",
    };
  }, [chartData]);

  // Custom tooltip (Nivo expects { point } for point tooltips, { slice } for slice tooltips)
  const CustomTooltip = ({ slice }: { slice: any }) => {
    if (!slice.points || slice.points.length === 0) return null;
    const point = slice.points[0];

    // Get pressure band for a given score
    const getPressureBand = (score: number) => {
      if (score >= 7.5) return { label: "Very High", color: "#ff4d4f" };
      if (score >= 5) return { label: "High", color: "#ffb347" };
      if (score >= 2) return { label: "Moderate", color: "#ffe066" };
      return { label: "Low", color: "#2e8b57" };
    };

    const date =
      typeof point.data.x === "string"
        ? new Date(point.data.x).toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
          })
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
          const pressureValue =
            typeof p.data.y === "number" ? p.data.y : Number(p.data.y);
          const band = getPressureBand(pressureValue);
          return (
            <div key={p.id} style={{ marginBottom: 2 }}>
              <div style={{ fontWeight: 600, color: band.color }}>
                {p.id}: {pressureValue.toFixed(1)}
              </div>
              <div style={{ color: "#aaa", fontSize: 12 }}>
                {band.label} pressure
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

  // Responsive chart margins
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const chartMargin = isMobile
    ? { top: 20, right: 10, bottom: 50, left: 60 }
    : { top: 20, right: 30, bottom: 50, left: 60 };
  const axisFontSize = isMobile ? 10 : 13;

  // X-axis tick formatting and reduction for mobile and long ranges
  const xTickValues = useMemo(() => {
    const dates = chartData.map((d) => d.date);
    if (dates.length > 60) {
      return dates.filter((_, i) => i % 14 === 0);
    } else if (dates.length > 30) {
      return dates.filter((_, i) => i % 7 === 0);
    } else if (isMobile) {
      return dates.filter((_, i) => i % 3 === 0);
    }
    return undefined;
  }, [chartData, isMobile]);

  const xTickFormat = (d: string) => {
    if (!d) return d;
    const dateObj = new Date(d);
    return isMobile
      ? dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : d;
  };

  return (
    <Card className="bg-white dark:bg-gray-900 text-black dark:text-white mt-6">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-2xl font-bold">Weed Pressure</CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-pointer">
                <Info className="w-4 h-4 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Weed pressure quantifies the risk of weed emergence and growth
              (0-10 scale).
              <br />
              Calculated from GDD accumulation, soil temperature, moisture
              conditions,
              <br />
              turf stress, and seasonal timing for each weed species.
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
              setDateRange={handleDateRange}
              onAllTime={handleAllTime}
              allTimeMode={allTimeMode}
            />
          </div>
          <span className="font-medium">Species:</span>
          <div className="w-full md:w-[400px] lg:w-[500px]">
            <Select
              isMulti
              options={species.map((s) => ({
                value: s.id,
                label: s.common_name,
              }))}
              value={species
                .filter((s) => selectedSpecies.includes(s.id))
                .map((s) => ({ value: s.id, label: s.common_name }))}
              onChange={(opts) =>
                setSelectedSpecies(opts.map((o: any) => o.value))
              }
              classNamePrefix="react-select"
              styles={selectStyles}
              placeholder="Select species"
            />
          </div>
        </div>
        <div className="h-[350px] w-full">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              Loading...
            </div>
          ) : chartLines.length ? (
            <ResponsiveLine
              data={chartLines}
              xScale={{ type: "point" }}
              yScale={{ type: "linear", min: 0, max: 10 }}
              axisBottom={{
                tickRotation: isMobile ? -60 : -30,
                tickValues: xTickValues,
                format: xTickFormat,
                legend: "",
                legendOffset: 36,
                legendPosition: "middle",
                tickSize: 6,
                tickPadding: 5,
              }}
              axisLeft={{
                legend: "Pressure",
                legendOffset: -40,
                legendPosition: "middle",
                tickSize: 6,
                tickPadding: 5,
                format: (v) => v.toFixed(0),
              }}
              margin={chartMargin}
              pointSize={8}
              enableSlices="x"
              theme={{
                ...nivoTheme,
                axis: {
                  ...nivoTheme.axis,
                  ticks: {
                    ...nivoTheme.axis.ticks,
                    text: {
                      ...nivoTheme.axis.ticks.text,
                      fontSize: axisFontSize,
                    },
                  },
                  legend: {
                    ...nivoTheme.axis.legend,
                    text: {
                      ...nivoTheme.axis.legend.text,
                      fontSize: axisFontSize,
                    },
                  },
                  domain: { line: { stroke: "#cbd5e1", strokeWidth: 2 } },
                },
              }}
              colors={(d) => d.color}
              layers={[
                // Background pressure bands
                ({ yScale, innerWidth }) => (
                  <g>
                    {PRESSURE_BANDS.map((band) => {
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
                "legends",
              ]}
              sliceTooltip={CustomTooltip}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              No data available for selected range.
            </div>
          )}
        </div>
        {currentStatus && (
          <div className="mt-4 border-t pt-4">
            <div className="text-2xl font-bold">
              {currentStatus.highest_pressure.toFixed(1)}
            </div>
            <div
              className="mt-1 text-xs font-semibold"
              style={{ color: currentStatus.status.color }}
            >
              {currentStatus.status.label}
            </div>
            <div
              className="mt-1 text-xs"
              style={{ color: currentStatus.status.color }}
            >
              {currentStatus.recommendations[0]}
            </div>
            <div className="mt-1 text-xs text-muted-foreground whitespace-pre-line">
              {currentStatus.recommendations.slice(1).join("\n")}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

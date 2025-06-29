import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "../api/fetcher";
import { ResponsiveLine } from "@nivo/line";
import Select from "react-select";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import "../react-date-range-dark.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DateRangePopover from "../components/DateRangePopover";

// List of available nutrients (field, label)
const NUTRIENTS = [
  { field: "n_applied", label: "N" },
  { field: "p_applied", label: "P" },
  { field: "k_applied", label: "K" },
  { field: "ca_applied", label: "Ca" },
  { field: "mg_applied", label: "Mg" },
  { field: "s_applied", label: "S" },
  { field: "fe_applied", label: "Fe" },
  { field: "cu_applied", label: "Cu" },
  { field: "mn_applied", label: "Mn" },
  { field: "b_applied", label: "B" },
  { field: "zn_applied", label: "Zn" },
  { field: "cost_applied", label: "Cost" },
];

// React Select shared styles
const selectStyles = {
  control: (base: any) => ({
    ...base,
    minHeight: 36,
    borderRadius: 6,
    backgroundColor: "var(--card)",
    borderColor: "var(--border)",
    boxShadow: "none",
    "&:hover": {
      borderColor: "var(--border)",
    },
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    boxShadow:
      "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "var(--accent)"
      : state.isFocused
      ? "var(--accent)"
      : "var(--card)",
    color:
      state.isSelected || state.isFocused
        ? "var(--accent-foreground)"
        : "var(--foreground)",
    "&:active": {
      backgroundColor: "var(--accent)",
    },
  }),
  singleValue: (base: any) => ({
    ...base,
    color: "var(--foreground)",
  }),
  multiValue: (base: any) => ({
    ...base,
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  }),
  multiValueLabel: (base: any) => ({
    ...base,
    color: "var(--accent-foreground)",
  }),
  multiValueRemove: (base: any) => ({
    ...base,
    color: "var(--accent-foreground)",
    "&:hover": {
      backgroundColor: "var(--destructive)",
      color: "var(--destructive-foreground)",
    },
  }),
  input: (base: any) => ({
    ...base,
    color: "var(--foreground)",
  }),
  placeholder: (base: any) => ({
    ...base,
    color: "var(--muted-foreground)",
  }),
  clearIndicator: (base: any) => ({
    ...base,
    color: "var(--muted-foreground)",
    "&:hover": {
      color: "var(--foreground)",
    },
  }),
  dropdownIndicator: (base: any) => ({
    ...base,
    color: "var(--muted-foreground)",
    "&:hover": {
      color: "var(--foreground)",
    },
  }),
};

// Nivo color scheme (category10)
const nivoColors = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
];

export default function Reports() {
  // State for filters
  const [selectedLawn, setSelectedLawn] = React.useState<string>("");
  const [dateRange, setDateRange] = React.useState<{
    start: string;
    end: string;
  } | null>(null);
  // Nutrient selection state (default N, P, K)
  const [selectedNutrients, setSelectedNutrients] = React.useState<string[]>([
    "n_applied",
    "p_applied",
    "k_applied",
  ]);

  // Fetch data
  const { data: applications } = useQuery({
    queryKey: ["applications"],
    queryFn: () => fetcher("/api/v1/applications/"),
    staleTime: 5 * 60 * 1000,
  });
  const { data: lawns, isLoading: lawnsLoading } = useQuery({
    queryKey: ["lawns"],
    queryFn: () => fetcher("/api/v1/lawns/"),
    staleTime: 5 * 60 * 1000,
  });
  // Fetch products for product name lookup
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => fetcher("/api/v1/products/"),
    staleTime: 5 * 60 * 1000,
  });

  // Build productMap for fast lookup
  const productMap = React.useMemo(() => {
    const map: Record<number, any> = {};
    if (Array.isArray(products)) {
      products.forEach((p: any) => {
        map[p.id] = p;
      });
    }
    return map;
  }, [products]);

  // Filtered and sorted applications (by lawn and date range)
  const filteredApps = React.useMemo(() => {
    const apps = Array.isArray(applications) ? applications : [];
    let filtered = apps;
    if (selectedLawn) {
      filtered = filtered.filter(
        (a: any) => String(a.lawn_id) === selectedLawn
      );
    }
    if (dateRange?.start) {
      filtered = filtered.filter(
        (a: any) => a.application_date >= dateRange.start
      );
    }
    if (dateRange?.end) {
      filtered = filtered.filter(
        (a: any) => a.application_date <= dateRange.end
      );
    }
    return filtered.sort((a: any, b: any) =>
      a.application_date.localeCompare(b.application_date)
    );
  }, [applications, selectedLawn, dateRange]);

  // Prepare cumulative data for selected nutrients for chart
  const chartData = React.useMemo(() => {
    const lawnsArr = Array.isArray(lawns) ? lawns : [];
    const appsArr = Array.isArray(filteredApps) ? filteredApps : [];
    if (!appsArr.length || !lawnsArr.length) return [];
    const selectedLawnObj = lawnsArr.find(
      (l: any) => String(l.id) === selectedLawn
    );
    if (!selectedLawnObj) return [];
    const lawnApps = appsArr.filter(
      (a: any) => String(a.lawn_id) === selectedLawn
    );
    const allDates = Array.from(
      new Set(lawnApps.map((a: any) => a.application_date))
    ).sort();
    if (allDates.length === 0) return [];
    // Initialize cumulative sums for each nutrient
    const cum: Record<string, number> = {};
    NUTRIENTS.forEach((n) => (cum[n.field] = 0));
    const result: any[] = [];
    allDates.forEach((date) => {
      const row: any = { date };
      selectedNutrients.forEach((nutrient) => {
        const sum = lawnApps
          .filter((a: any) => a.application_date === date)
          .reduce((s: number, a: any) => s + (a[nutrient] || 0), 0);
        cum[nutrient] += sum;
        row[nutrient] = cum[nutrient];
      });
      result.push(row);
    });
    return result;
  }, [filteredApps, lawns, selectedLawn, selectedNutrients]);

  // Prepare Nivo data for selected nutrients (use friendly label for id)
  const nivoData = React.useMemo(() => {
    if (!chartData || !selectedNutrients) return [];
    return selectedNutrients.map((nutrient) => {
      const nutrientObj = NUTRIENTS.find((n) => n.field === nutrient);
      return {
        id: nutrientObj ? nutrientObj.label : nutrient,
        data: chartData.map((row: any) => ({
          x: row.date,
          y: row[nutrient],
        })),
      };
    });
  }, [chartData, selectedNutrients]);

  // Dynamic Nivo theme for dark/light mode (matches GDD.tsx)
  const nivoTheme = React.useMemo(
    () => ({
      axis: {
        ticks: {
          text: {
            fill: "var(--nivo-axis-text, #222)",
            transition: "fill 0.2s",
          },
        },
        legend: {
          text: {
            fill: "var(--nivo-axis-text, #222)",
            transition: "fill 0.2s",
          },
        },
      },
      tooltip: {
        container: { background: "#222", color: "#fff" },
      },
      grid: {
        line: { stroke: "#444", strokeDasharray: "3 3" },
      },
    }),
    []
  );

  // Set selectedLawn to first lawn on initial load if not set
  React.useEffect(() => {
    if (!selectedLawn && Array.isArray(lawns) && lawns.length > 0) {
      setSelectedLawn(String(lawns[0].id));
    }
  }, [lawns, selectedLawn]);

  // Responsive Nivo chart margins, font size, tick rotation, and legend
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const chartMargin = isMobile
    ? { top: 16, right: 10, bottom: 80, left: 40 }
    : { top: 16, right: 24, bottom: 120, left: 60 };
  const axisFontSize = isMobile ? 10 : 13;
  const tickRotation = isMobile ? -30 : -45;
  const legendAnchor = isMobile ? "bottom" : "bottom";
  const legendDirection = isMobile ? "row" : "row";
  const legendTranslateY = isMobile ? 70 : 100;

  return (
    <div className="p-4 min-h-screen bg-background w-full">
      <Card className="min-h-[500px] w-full shadow-lg bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle className="text-2xl font-bold">Reports</CardTitle>
        </CardHeader>
        <CardContent className="overflow-y-auto max-h-[calc(100vh-100px)] p-2 md:p-6">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6 items-stretch w-full">
            {/* Lawn selector */}
            <div className="w-full md:min-w-[180px] md:flex-1">
              <label className="block text-sm font-medium mb-1">Lawn</label>
              <Select
                isSearchable
                options={
                  Array.isArray(lawns)
                    ? lawns.map((l: any) => ({
                        value: String(l.id),
                        label: l.name,
                      }))
                    : []
                }
                value={
                  Array.isArray(lawns)
                    ? lawns
                        .filter((l: any) => String(l.id) === selectedLawn)
                        .map((l: any) => ({
                          value: String(l.id),
                          label: l.name,
                        }))
                    : []
                }
                onChange={(opt: any) => setSelectedLawn(opt?.value)}
                isDisabled={lawnsLoading}
                classNamePrefix="react-select"
                styles={selectStyles}
                menuPlacement="auto"
                placeholder="Select lawn..."
              />
            </div>
            {/* Date range picker */}
            <div className="w-full md:min-w-[260px] md:flex-1 relative">
              <label className="block text-sm font-medium mb-1">
                Date Range
              </label>
              <DateRangePopover
                dateRange={dateRange}
                setDateRange={setDateRange}
              />
            </div>
            {/* Nutrient multi-select */}
            <div className="w-full md:min-w-[180px] md:flex-1">
              <label className="block text-sm font-medium mb-1">
                Nutrients
              </label>
              <Select
                isMulti
                options={NUTRIENTS.map((n) => ({
                  value: n.field,
                  label: n.label,
                }))}
                value={NUTRIENTS.filter((n) =>
                  selectedNutrients.includes(n.field)
                ).map((n) => ({ value: n.field, label: n.label }))}
                onChange={(opts) =>
                  setSelectedNutrients(opts.map((o: any) => o.value))
                }
                classNamePrefix="react-select"
                styles={selectStyles}
                menuPlacement="auto"
                placeholder="Select nutrients..."
              />
            </div>
          </div>

          {/* Chart */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-2">Cumulative Over Time</h2>
            <div
              className="bg-background dark:bg-gray-900 rounded shadow p-4 w-full"
              style={{ height: 400 }}
            >
              <ResponsiveLine
                data={nivoData}
                xScale={{ type: "point" }}
                yScale={{
                  type: "linear",
                  min: "auto",
                  max: "auto",
                  stacked: false,
                }}
                axisBottom={{
                  tickRotation,
                }}
                axisLeft={{
                  legend: "Cumulative",
                  legendOffset: -40,
                  legendPosition: "middle",
                }}
                margin={chartMargin}
                pointSize={8}
                useMesh={true}
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
                  },
                  legends: {
                    text: {
                      fill: "var(--nivo-axis-text, #222)",
                    },
                  },
                }}
                colors={{ scheme: "category10" }}
                enableSlices="x"
                tooltip={() => null}
                sliceTooltip={() => null}
                legends={
                  isMobile
                    ? []
                    : [
                        {
                          anchor: legendAnchor,
                          direction: legendDirection,
                          justify: false,
                          translateX: 0,
                          translateY: legendTranslateY,
                          itemsSpacing: 8,
                          itemDirection: "left-to-right",
                          itemWidth: 80,
                          itemHeight: 20,
                          itemOpacity: 0.75,
                          symbolSize: 12,
                          symbolShape: "circle",
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
              />
            </div>
            {/* Custom HTML legend for mobile (outside chart container) */}
            {isMobile && (
              <div
                className="flex overflow-x-auto gap-4 py-2 w-full mt-2"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {nivoData.map((series, i) => (
                  <div
                    key={series.id}
                    className="flex items-center min-w-[70px] flex-shrink-0"
                  >
                    <span
                      className="inline-block rounded-full mr-2"
                      style={{
                        width: 12,
                        height: 12,
                        backgroundColor: nivoColors[i % nivoColors.length],
                      }}
                    />
                    <span
                      style={{
                        color: "var(--nivo-axis-text, #222)",
                        fontSize: 13,
                      }}
                    >
                      {series.id}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Application History */}
          <div>
            <h2 className="text-lg font-semibold mb-2">Application History</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 rounded-lg overflow-hidden bg-background dark:bg-gray-900 text-xs text-black dark:text-white">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-2 py-1 text-left font-semibold">Date</th>
                    <th className="px-2 py-1 text-left font-semibold">Lawn</th>
                    <th className="px-2 py-1 text-left font-semibold">
                      Product
                    </th>
                    <th className="px-2 py-1 text-left font-semibold">N</th>
                    <th className="px-2 py-1 text-left font-semibold">P</th>
                    <th className="px-2 py-1 text-left font-semibold">K</th>
                    <th className="px-2 py-1 text-left font-semibold">Cost</th>
                    <th className="px-2 py-1 text-left font-semibold">
                      Status
                    </th>
                    <th className="px-2 py-1 text-left font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(filteredApps) &&
                    filteredApps.map((app: any, idx: number) => (
                      <tr
                        key={app.id}
                        className={
                          "border-b last:border-b-0 group hover:bg-muted/50 dark:hover:bg-gray-800 " +
                          (idx % 2 === 0
                            ? "bg-white dark:bg-gray-800"
                            : "bg-muted/30 dark:bg-gray-900")
                        }
                      >
                        <td className="px-2 py-1 border-b whitespace-nowrap font-medium">
                          {app.application_date}
                        </td>
                        <td className="px-2 py-1 border-b whitespace-nowrap">
                          {Array.isArray(lawns)
                            ? lawns.find((l: any) => l.id === app.lawn_id)
                                ?.name || app.lawn_id
                            : app.lawn_id}
                        </td>
                        <td className="px-2 py-1 border-b whitespace-nowrap">
                          {productMap[app.product_id]?.name || app.product_id}
                        </td>
                        <td className="px-2 py-1 border-b text-right">
                          {app.n_applied?.toFixed(2)}
                        </td>
                        <td className="px-2 py-1 border-b text-right">
                          {app.p_applied?.toFixed(2)}
                        </td>
                        <td className="px-2 py-1 border-b text-right">
                          {app.k_applied?.toFixed(2)}
                        </td>
                        <td className="px-2 py-1 border-b text-right">
                          {app.cost_applied
                            ? `$${app.cost_applied.toFixed(2)}`
                            : ""}
                        </td>
                        <td className="px-2 py-1 border-b whitespace-nowrap capitalize">
                          {app.status}
                        </td>
                        <td className="px-2 py-1 border-b whitespace-nowrap">
                          {app.notes}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

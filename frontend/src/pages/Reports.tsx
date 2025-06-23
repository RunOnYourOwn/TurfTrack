import React, { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "../api/fetcher";
import { ResponsiveLine } from "@nivo/line";
import Select from "react-select";
import { DateRange } from "react-date-range";
import {
  startOfYear,
  endOfYear,
  startOfMonth,
  endOfMonth,
  subYears,
  subMonths,
  format,
} from "date-fns";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import "../react-date-range-dark.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  // Prepare Nivo data for selected nutrients
  const nivoData = React.useMemo(() => {
    if (!chartData || !selectedNutrients) return [];
    return selectedNutrients.map((nutrient) => ({
      id: nutrient,
      data: chartData.map((row: any) => ({
        x: row.date,
        y: row[nutrient],
      })),
    }));
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

  return (
    <div className="p-4 min-h-screen bg-background w-full">
      <Card className="min-h-[500px] w-full shadow-lg bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle className="text-2xl font-bold">Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 items-end">
            {/* Lawn selector */}
            <div className="min-w-[180px] flex-1">
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
            <div className="flex flex-col min-w-[260px] flex-1 relative">
              <label className="block text-sm font-medium mb-1">
                Date Range
              </label>
              <DateRangePopover
                dateRange={dateRange}
                setDateRange={setDateRange}
              />
            </div>
            {/* Nutrient multi-select */}
            <div className="min-w-[180px] flex-1">
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
                  tickRotation: -45,
                  legend: "Date",
                  legendOffset: 36,
                  legendPosition: "middle",
                }}
                axisLeft={{
                  legend: "Cumulative",
                  legendOffset: -40,
                  legendPosition: "middle",
                }}
                margin={{ top: 16, right: 24, bottom: 50, left: 60 }}
                pointSize={8}
                useMesh={true}
                theme={nivoTheme}
                colors={{ scheme: "category10" }}
                enableSlices="x"
                tooltip={() => null}
                sliceTooltip={() => null}
              />
            </div>
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

// DateRangePopover component

function DateRangePopover({
  dateRange,
  setDateRange,
}: {
  dateRange: { start: string; end: string } | null;
  setDateRange: (r: { start: string; end: string } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Convert string dates to Date objects for react-date-range
  const selectionRange = {
    startDate: dateRange?.start ? new Date(dateRange.start) : null,
    endDate: dateRange?.end ? new Date(dateRange.end) : null,
    key: "selection",
  };
  // Preset ranges
  const now = new Date();
  const presets = [
    {
      label: "Year to Date",
      range: {
        start: format(startOfYear(now), "yyyy-MM-dd"),
        end: format(now, "yyyy-MM-dd"),
      },
    },
    {
      label: "Last Year",
      range: {
        start: format(startOfYear(subYears(now, 1)), "yyyy-MM-dd"),
        end: format(endOfYear(subYears(now, 1)), "yyyy-MM-dd"),
      },
    },
    {
      label: "This Month",
      range: {
        start: format(startOfMonth(now), "yyyy-MM-dd"),
        end: format(now, "yyyy-MM-dd"),
      },
    },
    {
      label: "Last Month",
      range: {
        start: format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd"),
        end: format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd"),
      },
    },
    {
      label: "All Time",
      range: null,
    },
  ];
  // Format display value
  const display =
    dateRange?.start && dateRange?.end
      ? `${format(new Date(dateRange.start), "MMM d, yyyy")} - ${format(
          new Date(dateRange.end),
          "MMM d, yyyy"
        )}`
      : "Select range";
  // Handle outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="border rounded px-2 py-1 w-full text-left bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-700 min-h-[36px]"
        onClick={() => setOpen((o) => !o)}
      >
        {display}
      </button>
      {open && (
        <div
          className="absolute z-50 mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg p-4 text-black dark:text-white"
          style={{ minWidth: 320 }}
        >
          <DateRange
            ranges={[
              {
                startDate: selectionRange.startDate || new Date(),
                endDate: selectionRange.endDate || new Date(),
                key: "selection",
              },
            ]}
            onChange={(ranges: any) => {
              const sel = ranges.selection;
              setDateRange({
                start: format(sel.startDate, "yyyy-MM-dd"),
                end: format(sel.endDate, "yyyy-MM-dd"),
              });
            }}
            moveRangeOnFirstSelection={false}
            showSelectionPreview={true}
            editableDateInputs={true}
            rangeColors={["#2563eb"]}
            direction="vertical"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="text-xs px-2 py-1 rounded border bg-muted dark:bg-gray-700 dark:text-white hover:bg-muted/70 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-700"
                onClick={() => {
                  if (preset.range) setDateRange(preset.range);
                  else setDateRange(null);
                  setOpen(false);
                }}
              >
                {preset.label}
              </button>
            ))}
            {(dateRange?.start || dateRange?.end) && (
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border bg-muted dark:bg-gray-700 dark:text-white hover:bg-muted/70 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-700"
                onClick={() => {
                  setDateRange(null);
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "../api/fetcher";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import "../react-date-range-dark.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NUTRIENTS } from "@/lib/nutrients";
import { ReportsFilters } from "@/components/reports/ReportsFilters";
import { ReportsChart } from "@/components/reports/ReportsChart";
import { ReportsTable } from "@/components/reports/ReportsTable";

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

  // Set selectedLawn to first lawn on initial load if not set
  React.useEffect(() => {
    if (!selectedLawn && Array.isArray(lawns) && lawns.length > 0) {
      setSelectedLawn(String(lawns[0].id));
    }
  }, [lawns, selectedLawn]);

  // Responsive detection
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div className="p-4 min-h-screen bg-background w-full">
      <Card className="min-h-[500px] w-full shadow-lg bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle className="text-2xl font-bold">Reports</CardTitle>
        </CardHeader>
        <CardContent className="overflow-y-auto max-h-[calc(100vh-100px)] p-2 md:p-6">
          <ReportsFilters
            lawns={Array.isArray(lawns) ? lawns : []}
            lawnsLoading={lawnsLoading}
            selectedLawn={selectedLawn}
            setSelectedLawn={setSelectedLawn}
            dateRange={dateRange}
            setDateRange={setDateRange}
            selectedNutrients={selectedNutrients}
            setSelectedNutrients={setSelectedNutrients}
          />

          <ReportsChart data={nivoData} isMobile={isMobile} />

          <ReportsTable
            filteredApps={filteredApps}
            lawns={Array.isArray(lawns) ? lawns : []}
            productMap={productMap}
          />
        </CardContent>
      </Card>
    </div>
  );
}

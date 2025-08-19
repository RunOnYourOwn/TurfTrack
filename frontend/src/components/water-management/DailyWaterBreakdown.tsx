import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { ResponsiveBar } from "@nivo/bar";
import { WeeklyWaterSummary } from "../../types/water-management";
import { fetcher } from "../../lib/fetcher";
import { format } from "date-fns";
import { Calendar } from "lucide-react";

interface DailyWaterData {
  date: string;
  et0: number;
  precipitation: number;
  irrigation: number;
  deficit: number;
  is_forecast: boolean;
}

interface DailyWaterBreakdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  week: WeeklyWaterSummary | null;
  lawnId: number;
}

export function DailyWaterBreakdown({
  open,
  onOpenChange,
  week,
  lawnId,
}: DailyWaterBreakdownProps) {
  const [dailyData, setDailyData] = useState<DailyWaterData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && week) {
      loadDailyData();
    }
  }, [open, week]);

  const loadDailyData = async () => {
    if (!week) return;

    setLoading(true);
    try {
      // Fetch weather data for the week
      const weatherData = await fetcher<any[]>(
        `/api/v1/weather/lawn/${lawnId}?start_date=${week.week_start}&end_date=${week.week_end}`
      );

      // Fetch irrigation data for the week
      const irrigationData = await fetcher<any[]>(
        `/api/v1/water-management/lawn/${lawnId}/irrigation?start_date=${week.week_start}&end_date=${week.week_end}`
      );

      // Create a map of irrigation data by date
      const irrigationByDate = new Map();
      irrigationData.forEach((entry) => {
        irrigationByDate.set(entry.date, entry.amount);
      });

      // Combine weather and irrigation data
      const combinedData: DailyWaterData[] = weatherData.map((day) => {
        const irrigation = irrigationByDate.get(day.date) || 0;
        const et0 = day.et0_evapotranspiration_in || 0;
        const precipitation = day.precipitation_in || 0;
        const deficit = et0 - precipitation - irrigation;

        return {
          date: day.date,
          et0,
          precipitation,
          irrigation,
          deficit,
          is_forecast: day.type === "forecast",
        };
      });

      // Sort by date to ensure Monday-Sunday order
      combinedData.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setDailyData(combinedData);
    } catch (error) {
      console.error("Failed to load daily water data:", error);
      setDailyData([]);
    } finally {
      setLoading(false);
    }
  };

  const chartData = dailyData.map((day) => ({
    day: format(new Date(day.date + "T00:00:00"), "EEE, MMM d"),
    date: day.date,
    "Water Needed (ET0)": Number(day.et0.toFixed(2)),
    Precipitation: Number(day.precipitation.toFixed(2)),
    Irrigation: Number(day.irrigation.toFixed(2)),
  }));

  // Calculate totals from daily data
  const totalEt0 = dailyData.reduce((sum, day) => sum + day.et0, 0);
  const totalPrecipitation = dailyData.reduce(
    (sum, day) => sum + day.precipitation,
    0
  );
  const totalIrrigation = dailyData.reduce(
    (sum, day) => sum + day.irrigation,
    0
  );
  const totalDeficit = dailyData.reduce((sum, day) => sum + day.deficit, 0);

  const barAriaLabel = (e: any) => {
    return `${e.dataKey}: ${e.value.toFixed(2)} inches`;
  };

  const getStatusColor = (deficit: number) => {
    if (deficit <= 0) return "text-green-600 dark:text-green-400";
    if (deficit <= 0.5) return "text-yellow-600 dark:text-yellow-400";
    if (deficit <= 1.0) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getStatusIcon = (deficit: number) => {
    if (deficit <= 0) return "🌱";
    if (deficit <= 0.5) return "✅";
    if (deficit <= 1.0) return "⚠️";
    return "🚨";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {week ? (
              <>
                Daily Water Breakdown:{" "}
                {format(new Date(week.week_start + "T00:00:00"), "MMM d")} -{" "}
                {format(new Date(week.week_end + "T00:00:00"), "MMM d, yyyy")}
              </>
            ) : (
              "Daily Water Breakdown"
            )}
          </DialogTitle>
          {week?.is_forecast && (
            <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-400 px-2 py-1 rounded">
              Forecast
            </span>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-lg">Loading daily data...</div>
          </div>
        ) : dailyData.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">
              No daily data available for this week
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Weekly Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-card border rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {totalEt0.toFixed(2)}"
                </div>
                <div className="text-sm text-muted-foreground">Total ET0</div>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {totalPrecipitation.toFixed(2)}"
                </div>
                <div className="text-sm text-muted-foreground">Total Rain</div>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {totalIrrigation.toFixed(2)}"
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Applied
                </div>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {totalDeficit.toFixed(2)}"
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Deficit
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="h-80">
              <ResponsiveBar
                data={chartData}
                keys={["Water Needed (ET0)", "Precipitation", "Irrigation"]}
                indexBy="day"
                margin={{ top: 20, right: 150, bottom: 80, left: 60 }}
                padding={0.3}
                groupMode="stacked"
                valueScale={{ type: "linear" }}
                indexScale={{ type: "band", round: true }}
                colors={["#ef4444", "#3b82f6", "#93c5fd"]}
                borderColor={{
                  from: "color",
                  modifiers: [["darker", 1.6]],
                }}
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  tickSize: 5,
                  tickPadding: 12,
                  tickRotation: -25,
                }}
                axisLeft={{
                  tickSize: 5,
                  tickPadding: 5,
                  tickRotation: 0,
                  legend: "Water (inches)",
                  legendOffset: -40,
                  legendPosition: "middle",
                }}
                labelSkipWidth={12}
                labelSkipHeight={12}
                labelTextColor={{
                  from: "color",
                  modifiers: [["darker", 1.6]],
                }}
                label={(d) =>
                  d.value && d.value > 0.05 ? d.value.toFixed(2) : ""
                }
                legends={[
                  {
                    dataFrom: "keys",
                    anchor: "bottom-right",
                    direction: "column",
                    justify: false,
                    translateX: 140,
                    translateY: 0,
                    itemsSpacing: 2,
                    itemWidth: 120,
                    itemHeight: 20,
                    itemDirection: "left-to-right",
                    itemOpacity: 0.85,
                    symbolSize: 20,
                    effects: [
                      {
                        on: "hover",
                        style: {
                          itemOpacity: 1,
                        },
                      },
                    ],
                  },
                ]}
                role="application"
                ariaLabel="Daily water balance chart"
                barAriaLabel={barAriaLabel}
              />
            </div>

            {/* Daily Details Table */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Daily Details</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3">Date</th>
                      <th className="text-right py-2 px-3">ET0</th>
                      <th className="text-right py-2 px-3">Rain</th>
                      <th className="text-right py-2 px-3">Applied</th>
                      <th className="text-right py-2 px-3">Deficit</th>
                      <th className="text-center py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.map((day) => (
                      <tr
                        key={day.date}
                        className="border-b border-gray-100 dark:border-gray-800"
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            {format(
                              new Date(day.date + "T00:00:00"),
                              "EEE, MMM d"
                            )}
                            {day.is_forecast && (
                              <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-400 px-1 py-0.5 rounded">
                                F
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-sm text-right">
                          {day.et0.toFixed(2)}"
                        </td>
                        <td className="py-2 px-3 text-sm text-right">
                          {day.precipitation.toFixed(2)}"
                        </td>
                        <td className="py-2 px-3 text-sm text-right">
                          {day.irrigation.toFixed(2)}"
                        </td>
                        <td
                          className={`py-2 px-3 text-sm font-medium text-right ${getStatusColor(
                            day.deficit
                          )}`}
                        >
                          {day.deficit.toFixed(2)}"
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-lg">
                            {getStatusIcon(day.deficit)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Calendar } from "lucide-react";
import { WaterStatusBadge } from "./WaterStatusBadge";
import { WeeklyWaterSummary } from "../../types/water-management";
import { format } from "date-fns";

interface WeeklyWaterHistoryProps {
  weeklyData: WeeklyWaterSummary[];
  onWeekClick?: (week: WeeklyWaterSummary) => void;
}

export function WeeklyWaterHistory({
  weeklyData,
  onWeekClick,
}: WeeklyWaterHistoryProps) {
  if (!weeklyData || weeklyData.length === 0) {
    return (
      <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Water History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-500">No weekly data available</div>
        </CardContent>
      </Card>
    );
  }

  // Show the last 8 weeks
  const recentWeeks = weeklyData.slice(-8);

  return (
    <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Weekly Water History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentWeeks.map((week) => (
            <div
              key={week.week_start}
              className={`flex items-center justify-between p-3 border rounded-lg transition-all duration-200 ${
                week.is_forecast
                  ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700"
              } ${
                onWeekClick
                  ? "cursor-pointer hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600"
                  : ""
              }`}
              onClick={() => onWeekClick?.(week)}
            >
              <div className="flex items-center gap-3">
                <div>
                  <div className="font-medium">
                    {format(new Date(week.week_start + "T00:00:00"), "MMM d")} -{" "}
                    {format(
                      new Date(week.week_end + "T00:00:00"),
                      "MMM d, yyyy"
                    )}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {week.et0_total.toFixed(2)}" needed •{" "}
                    {week.precipitation_total.toFixed(2)}" rain •{" "}
                    {week.irrigation_applied.toFixed(2)}" applied
                  </div>
                </div>
                {week.is_forecast && (
                  <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-400 px-2 py-1 rounded">
                    Forecast
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    week.water_deficit <= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-orange-600 dark:text-orange-400"
                  }`}
                >
                  {week.water_deficit.toFixed(2)}" deficit
                </span>
                <WaterStatusBadge status={week.status} className="text-xs" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

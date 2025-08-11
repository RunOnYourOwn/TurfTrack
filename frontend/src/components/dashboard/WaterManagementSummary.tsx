import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { fetcher } from "../../lib/fetcher";
import { Lawn } from "../../types/lawn";
import { Calendar, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

// WeatherData interface removed - no longer needed since we use stored weekly summaries

type WeeklyWaterSummary = {
  week_start: string;
  week_end: string;
  et0_total: number;
  precipitation_total: number;
  irrigation_applied: number;
  water_deficit: number;
  status: "good" | "warning" | "critical" | "excellent";
};

interface WaterManagementSummaryProps {
  lawn: Lawn;
}

export default function WaterManagementSummary({
  lawn,
}: WaterManagementSummaryProps) {
  const [currentWeek, setCurrentWeek] = useState<WeeklyWaterSummary | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lawn) return;
    setLoading(true);
    setError(null);

    fetcher<{
      lawn_id: number;
      current_week: WeeklyWaterSummary | null;
      weekly_data: WeeklyWaterSummary[];
      total_monthly_water: number;
    }>(`/api/v1/water-management/lawn/${lawn.id}/summary`)
      .then((summary) => {
        setCurrentWeek(summary.current_week);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load water management data:", error);
        setError("Failed to load water management data.");
        setLoading(false);
      });
  }, [lawn]);

  // No longer need to calculate weekly data - it comes pre-calculated from the backend

  const getStatusColor = (status: string) => {
    switch (status) {
      case "excellent":
        return "bg-green-100 text-green-800 border-green-200";
      case "good":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "excellent":
        return "🌱";
      case "good":
        return "✅";
      case "warning":
        return "⚠️";
      case "critical":
        return "💧";
      default:
        return "❓";
    }
  };

  const getRecommendation = (deficit: number) => {
    if (deficit <= 0) return "No irrigation needed";
    if (deficit <= 0.5) return "Light irrigation recommended";
    if (deficit <= 1.0) return "Moderate irrigation needed";
    return "Heavy irrigation required";
  };

  if (loading) {
    return (
      <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Water Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center">
            Loading water management data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !currentWeek) {
    return (
      <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Water Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-red-500">
            {error || "No water data available"}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-2xl font-bold">Water Management</CardTitle>
          <Badge className={getStatusColor(currentWeek.status)}>
            {getStatusIcon(currentWeek.status)} {currentWeek.status}
          </Badge>
        </div>
        <Link to={`/water?lawn=${lawn.id}`}>
          <Button variant="outline" size="sm">
            View Details
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {/* Weekly Summary */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4" />
            <span className="font-medium">This Week's Summary</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">
                {currentWeek.et0_total.toFixed(2)}"
              </div>
              <div className="text-xs text-blue-600">Water Needed</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">
                {currentWeek.precipitation_total.toFixed(2)}"
              </div>
              <div className="text-xs text-green-600">Rainfall</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-lg font-bold text-purple-600">
                {currentWeek.irrigation_applied.toFixed(2)}"
              </div>
              <div className="text-xs text-purple-600">Applied</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-lg font-bold text-orange-600">
                {currentWeek.water_deficit.toFixed(2)}"
              </div>
              <div className="text-xs text-orange-600">Deficit</div>
            </div>
          </div>
        </div>

        {/* Recommendation */}
        <div className="mb-4">
          <div className="text-sm font-medium mb-2">Recommendation</div>
          <div className="text-sm text-gray-600">
            {getRecommendation(currentWeek.water_deficit)}
          </div>
        </div>

        {/* Water Balance Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Water Balance</span>
            <span>{currentWeek.water_deficit.toFixed(2)}" deficit</span>
          </div>
          <Progress
            value={Math.max(
              0,
              Math.min(
                100,
                (currentWeek.water_deficit / currentWeek.et0_total) * 100
              )
            )}
            className="h-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}

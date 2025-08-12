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
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Water Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Water Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!currentWeek) {
    return (
      <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Water Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-500">
            No water management data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const deficit = currentWeek.water_deficit;
  const recommendation = getRecommendation(deficit);

  return (
    <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Water Management
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(currentWeek.status)}>
              {getStatusIcon(currentWeek.status)} {currentWeek.status}
            </Badge>
            <Button variant="outline" size="sm" asChild className="text-xs">
              <Link to={`/water?lawn=${lawn.id}`}>
                View Details
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3">This Week's Summary</h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <div className="text-blue-600 dark:text-blue-400 text-lg font-semibold">
                  {currentWeek.et0_total.toFixed(2)}"
                </div>
                <div className="text-blue-500 dark:text-blue-300 text-xs">
                  Water Needed
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                <div className="text-green-600 dark:text-green-400 text-lg font-semibold">
                  {currentWeek.precipitation_total.toFixed(2)}"
                </div>
                <div className="text-green-500 dark:text-green-300 text-xs">
                  Rainfall
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                <div className="text-purple-600 dark:text-purple-400 text-lg font-semibold">
                  {currentWeek.irrigation_applied.toFixed(2)}"
                </div>
                <div className="text-purple-500 dark:text-purple-300 text-xs">
                  Applied
                </div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                <div className="text-orange-600 dark:text-orange-400 text-lg font-semibold">
                  {deficit.toFixed(2)}"
                </div>
                <div className="text-orange-500 dark:text-orange-300 text-xs">
                  Deficit
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-1">Recommendation</h4>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {recommendation}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Water Balance</h4>
            <div className="flex items-center gap-3">
              <Progress
                value={Math.max(0, Math.min(100, (1 - deficit / 2) * 100))}
                className="flex-1"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {deficit.toFixed(2)} deficit
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// New condensed component for dashboard
interface CondensedWaterManagementCardProps {
  lawn: Lawn;
}

export function CondensedWaterManagementCard({
  lawn,
}: CondensedWaterManagementCardProps) {
  const [currentWeek, setCurrentWeek] = useState<WeeklyWaterSummary | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lawn) return;
    setLoading(true);

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
        setLoading(false);
      });
  }, [lawn]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "excellent":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800";
      case "good":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800";
      case "critical":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800";
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

  if (loading) {
    return (
      <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>{lawn.name}</span>
            <div className="animate-pulse h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentWeek) {
    return (
      <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>{lawn.name}</span>
            <Badge variant="outline" className="text-xs">
              No Data
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-gray-500 text-xs">
            No water management data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const deficit = currentWeek.water_deficit;

  return (
    <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>{lawn.name}</span>
          <Badge className={`text-xs ${getStatusColor(currentWeek.status)}`}>
            {getStatusIcon(currentWeek.status)} {currentWeek.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Water:</span>
              <span className="font-medium">
                {currentWeek.et0_total.toFixed(2)}"
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Rain:</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {currentWeek.precipitation_total.toFixed(2)}"
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Applied:</span>
              <span className="font-medium text-purple-600 dark:text-purple-400">
                {currentWeek.irrigation_applied.toFixed(2)}"
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Deficit:</span>
              <span
                className={`font-medium ${
                  deficit <= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-orange-600 dark:text-orange-400"
                }`}
              >
                {deficit.toFixed(2)}"
              </span>
            </div>
          </div>
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="w-full text-xs"
            >
              <Link to={`/water?lawn=${lawn.id}`}>
                View Details
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

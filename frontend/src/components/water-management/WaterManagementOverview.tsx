import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Droplets } from "lucide-react";
import { WaterStatusCard } from "./WaterStatusCard";
import { WaterStatusBadge } from "./WaterStatusBadge";
import { WaterBalanceProgress } from "./WaterBalanceProgress";
import { WaterRecommendation } from "./WaterRecommendation";
import { WeeklyWaterSummary } from "../../types/water-management";

interface WaterManagementOverviewProps {
  currentWeek: WeeklyWaterSummary | null;
  totalMonthlyWater: number;
}

export function WaterManagementOverview({
  currentWeek,
  totalMonthlyWater,
}: WaterManagementOverviewProps) {
  if (!currentWeek) {
    return (
      <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5" />
            Monthly Water Usage
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

  return (
    <div className="space-y-6">
      {/* Monthly Water Usage */}
      <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5" />
            Monthly Water Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {totalMonthlyWater.toFixed(2)}"
          </div>
          <div className="text-gray-600 dark:text-gray-400 text-sm">
            Total irrigation applied this month
          </div>
        </CardContent>
      </Card>

      {/* This Week's Water Status */}
      <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5" />
              This Week's Water Status
            </CardTitle>
            <WaterStatusBadge status={currentWeek.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <WaterStatusCard
                value={currentWeek.et0_total}
                label="Water Needed"
                color="blue"
              />
              <WaterStatusCard
                value={currentWeek.precipitation_total}
                label="Rainfall"
                color="green"
              />
              <WaterStatusCard
                value={currentWeek.irrigation_applied}
                label="Irrigation Applied"
                color="purple"
              />
              <WaterStatusCard value={deficit} label="Deficit" color="orange" />
            </div>

            <WaterRecommendation deficit={deficit} />

            <div>
              <h4 className="text-sm font-medium mb-2">Water Balance</h4>
              <WaterBalanceProgress deficit={deficit} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

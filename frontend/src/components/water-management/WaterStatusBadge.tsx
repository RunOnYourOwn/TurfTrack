import { Badge } from "../ui/badge";
import { WaterStatus } from "../../types/water-management";

interface WaterStatusBadgeProps {
  status: WaterStatus;
  className?: string;
}

export function WaterStatusBadge({
  status,
  className = "",
}: WaterStatusBadgeProps) {
  const getStatusColor = (status: WaterStatus) => {
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

  const getStatusIcon = (status: WaterStatus) => {
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

  return (
    <Badge className={`${getStatusColor(status)} ${className}`}>
      {getStatusIcon(status)} {status}
    </Badge>
  );
}

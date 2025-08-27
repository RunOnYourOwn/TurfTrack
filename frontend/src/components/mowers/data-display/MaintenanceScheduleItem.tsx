import { format } from "date-fns";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MaintenanceScheduleRead } from "@/types/mower";
import { mowerUtils } from "@/lib/mowerApi";

interface MaintenanceScheduleItemProps {
  schedule: MaintenanceScheduleRead;
  onEdit: (schedule: MaintenanceScheduleRead) => void;
  onDelete: (schedule: MaintenanceScheduleRead) => void;
}

export function MaintenanceScheduleItem({
  schedule,
  onEdit,
  onDelete,
}: MaintenanceScheduleItemProps) {
  const displayName =
    schedule.custom_name ||
    mowerUtils.getMaintenanceTypeDisplayName(schedule.maintenance_type);

  const intervalText =
    schedule.interval_hours > 0
      ? `${schedule.interval_hours} hours`
      : (schedule.interval_months || 0) > 0
      ? `${schedule.interval_months} months`
      : "No interval set";

  const lastMaintenanceText = schedule.last_maintenance_date
    ? format(new Date(schedule.last_maintenance_date), "MMM d, yyyy")
    : "Never";

  return (
    <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="flex-1">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {displayName}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Every {intervalText} • Last: {lastMaintenanceText}
            </div>
            {schedule.notes && (
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {schedule.notes}
              </div>
            )}
            {schedule.next_maintenance_date && (
              <div className="mt-2">
                <Badge variant="outline" className="text-xs">
                  Next:{" "}
                  {format(
                    new Date(schedule.next_maintenance_date),
                    "MMM d, yyyy"
                  )}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(schedule)}
          className="h-8 w-8 p-0"
        >
          <PencilIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(schedule)}
          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
        >
          <Trash2Icon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

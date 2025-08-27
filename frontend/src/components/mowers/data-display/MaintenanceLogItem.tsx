import { format } from "date-fns";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MaintenanceLogRead } from "@/types/mower";
import { mowerUtils } from "@/lib/mowerApi";

interface MaintenanceLogItemProps {
  log: MaintenanceLogRead;
  onEdit: (log: MaintenanceLogRead) => void;
  onDelete: (log: MaintenanceLogRead) => void;
}

export function MaintenanceLogItem({
  log,
  onEdit,
  onDelete,
}: MaintenanceLogItemProps) {
  const displayName =
    log.custom_name ||
    mowerUtils.getMaintenanceTypeDisplayName(log.maintenance_type);

  return (
    <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="flex-1">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {displayName}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {format(new Date(log.maintenance_date), "MMM d, yyyy")} •{" "}
              {log.hours_at_maintenance} hours
              {log.total_cost && ` • ${mowerUtils.formatCost(log.total_cost)}`}
            </div>
            {log.performed_by && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Performed by: {log.performed_by}
              </div>
            )}
            {log.notes && (
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {log.notes}
              </div>
            )}
            {log.parts_used && log.parts_used.length > 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Parts: {log.parts_used.map((part) => part.part_name).join(", ")}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(log)}
          className="h-8 w-8 p-0"
        >
          <PencilIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(log)}
          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
        >
          <Trash2Icon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

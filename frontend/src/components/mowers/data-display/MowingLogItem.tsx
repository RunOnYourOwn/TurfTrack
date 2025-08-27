import { format } from "date-fns";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MowingLogRead } from "@/types/mower";
import { mowerUtils } from "@/lib/mowerApi";

interface MowingLogItemProps {
  log: MowingLogRead;
  lawnName?: string;
  onEdit: (log: MowingLogRead) => void;
  onDelete: (log: MowingLogRead) => void;
}

export function MowingLogItem({
  log,
  lawnName,
  onEdit,
  onDelete,
}: MowingLogItemProps) {
  return (
    <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="flex-1">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {format(new Date(log.mowing_date), "MMM d, yyyy")}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {lawnName || `Lawn ${log.lawn_id}`} •{" "}
              {mowerUtils.formatHours(log.duration_minutes / 60)}
            </div>
            {log.notes && (
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {log.notes}
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

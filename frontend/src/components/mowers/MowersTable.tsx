import { Button } from "@/components/ui/button";
import {
  PencilIcon,
  Trash2Icon,
  ChevronUp,
  ChevronDown,
  ClockIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { mowerUtils } from "@/lib/mowerApi";
import type { MowerRead } from "@/types/mower";

interface MowersTableProps {
  mowers: MowerRead[];
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
  onEdit: (mower: MowerRead) => void;
  onDelete: (mower: MowerRead) => void;
  onLogMowing: (mower: MowerRead) => void;
}

export default function MowersTable({
  mowers,
  sortBy,
  sortDir,
  onSort,
  onEdit,
  onDelete,
  onLogMowing,
}: MowersTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse rounded-lg bg-background dark:bg-gray-900 text-sm text-black dark:text-white align-middle border-b border-muted-foreground">
        <thead>
          <tr className="bg-muted">
            <th
              className="px-4 py-2 text-left font-semibold cursor-pointer select-none"
              onClick={() => onSort("name")}
            >
              Name{" "}
              {sortBy === "name" &&
                (sortDir === "asc" ? (
                  <ChevronUp className="inline w-3 h-3" />
                ) : (
                  <ChevronDown className="inline w-3 h-3" />
                ))}
            </th>
            <th
              className="px-4 py-2 text-left font-semibold cursor-pointer select-none"
              onClick={() => onSort("mower_type")}
            >
              Type{" "}
              {sortBy === "mower_type" &&
                (sortDir === "asc" ? (
                  <ChevronUp className="inline w-3 h-3" />
                ) : (
                  <ChevronDown className="inline w-3 h-3" />
                ))}
            </th>
            <th
              className="px-4 py-2 text-left font-semibold cursor-pointer select-none"
              onClick={() => onSort("location")}
            >
              Location{" "}
              {sortBy === "location" &&
                (sortDir === "asc" ? (
                  <ChevronUp className="inline w-3 h-3" />
                ) : (
                  <ChevronDown className="inline w-3 h-3" />
                ))}
            </th>
            <th
              className="px-4 py-2 text-left font-semibold cursor-pointer select-none"
              onClick={() => onSort("total_hours")}
            >
              Total Hours{" "}
              {sortBy === "total_hours" &&
                (sortDir === "asc" ? (
                  <ChevronUp className="inline w-3 h-3" />
                ) : (
                  <ChevronDown className="inline w-3 h-3" />
                ))}
            </th>
            <th
              className="px-4 py-2 text-center font-semibold cursor-pointer select-none"
              onClick={() => onSort("is_active")}
            >
              Status{" "}
              {sortBy === "is_active" &&
                (sortDir === "asc" ? (
                  <ChevronUp className="inline w-3 h-3" />
                ) : (
                  <ChevronDown className="inline w-3 h-3" />
                ))}
            </th>
            <th className="px-4 py-2 text-center font-semibold">
              Maintenance Due
            </th>
            <th className="px-4 py-2 text-center font-semibold">Log Mowing</th>
            <th className="px-4 py-2 text-center font-semibold">Edit</th>
            <th className="px-4 py-2 text-center font-semibold">Delete</th>
          </tr>
        </thead>
        <tbody>
          {mowers.map((mower, idx) => {
            const isLast = idx === mowers.length - 1;
            return (
              <tr
                key={mower.id}
                className={
                  "group hover:bg-muted/50 dark:hover:bg-gray-800 align-middle " +
                  (idx % 2 === 0
                    ? "bg-background dark:bg-gray-900"
                    : "bg-muted/30 dark:bg-gray-800") +
                  (isLast ? "" : " border-b border-muted-foreground")
                }
              >
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium">{mower.name}</div>
                    {mower.brand && mower.model && (
                      <div className="text-xs text-muted-foreground">
                        {mower.brand} {mower.model}
                        {mower.year && ` (${mower.year})`}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline">
                    {mowerUtils.getMowerTypeDisplayName(mower.mower_type)}
                  </Badge>
                </td>
                <td className="px-4 py-3">{mower.location.name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span>{mowerUtils.formatHours(mower.total_hours)}</span>
                    {mower.engine_hours > 0 && (
                      <span className="text-xs text-muted-foreground">
                        (Base: {mower.engine_hours}h)
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={mower.is_active ? "default" : "secondary"}>
                    {mower.is_active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center">
                  {mower.next_maintenance_due &&
                  mower.next_maintenance_due.length > 0 ? (
                    <Badge variant="destructive">
                      {mower.next_maintenance_due.length} due
                    </Badge>
                  ) : (
                    <Badge variant="outline">Up to date</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onLogMowing(mower)}
                    className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                    title="Log Mowing Session"
                  >
                    <ClockIcon className="h-4 w-4" />
                  </Button>
                </td>
                <td className="px-4 py-3 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(mower)}
                    className="h-8 w-8 p-0"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                </td>
                <td className="px-4 py-3 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(mower)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

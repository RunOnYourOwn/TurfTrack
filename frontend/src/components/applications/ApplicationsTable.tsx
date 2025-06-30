import React from "react";
import { Button } from "@/components/ui/button";
import { PencilIcon, Trash2Icon, ChevronUp, ChevronDown } from "lucide-react";

interface ApplicationsTableProps {
  applications: any[];
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
  lawnMap: Record<number, any>;
  productMap: Record<number, any>;
  gddModelMap: Record<number, any>;
  onEdit: (app: any) => void;
  onDelete: (app: any) => void;
}

export const ApplicationsTable: React.FC<ApplicationsTableProps> = ({
  applications,
  sortBy,
  sortDir,
  onSort,
  lawnMap,
  productMap,
  gddModelMap,
  onEdit,
  onDelete,
}) => (
  <div className="overflow-x-auto">
    <table className="min-w-full border-separate border-spacing-0 rounded-lg overflow-hidden bg-background dark:bg-gray-900 text-xs text-black dark:text-white">
      <thead>
        <tr className="bg-muted">
          <th
            className="px-2 py-1 text-left font-semibold cursor-pointer select-none"
            onClick={() => onSort("application_date")}
          >
            Date{" "}
            {sortBy === "application_date" &&
              (sortDir === "asc" ? (
                <ChevronUp className="inline w-3 h-3" />
              ) : (
                <ChevronDown className="inline w-3 h-3" />
              ))}
          </th>
          <th
            className="px-2 py-1 text-left font-semibold cursor-pointer select-none"
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
            className="px-2 py-1 text-left font-semibold cursor-pointer select-none"
            onClick={() => onSort("lawn")}
          >
            Lawn{" "}
            {sortBy === "lawn" &&
              (sortDir === "asc" ? (
                <ChevronUp className="inline w-3 h-3" />
              ) : (
                <ChevronDown className="inline w-3 h-3" />
              ))}
          </th>
          <th
            className="px-2 py-1 text-left font-semibold cursor-pointer select-none"
            onClick={() => onSort("product")}
          >
            Product{" "}
            {sortBy === "product" &&
              (sortDir === "asc" ? (
                <ChevronUp className="inline w-3 h-3" />
              ) : (
                <ChevronDown className="inline w-3 h-3" />
              ))}
          </th>
          <th
            className="px-2 py-1 text-left font-semibold cursor-pointer select-none"
            onClick={() => onSort("amount_per_area")}
          >
            Amount{" "}
            {sortBy === "amount_per_area" &&
              (sortDir === "asc" ? (
                <ChevronUp className="inline w-3 h-3" />
              ) : (
                <ChevronDown className="inline w-3 h-3" />
              ))}
          </th>
          <th
            className="px-2 py-1 text-left font-semibold cursor-pointer select-none"
            onClick={() => onSort("status")}
          >
            Status{" "}
            {sortBy === "status" &&
              (sortDir === "asc" ? (
                <ChevronUp className="inline w-3 h-3" />
              ) : (
                <ChevronDown className="inline w-3 h-3" />
              ))}
          </th>
          <th
            className="px-2 py-1 text-left font-semibold cursor-pointer select-none"
            onClick={() => onSort("notes")}
          >
            Notes{" "}
            {sortBy === "notes" &&
              (sortDir === "asc" ? (
                <ChevronUp className="inline w-3 h-3" />
              ) : (
                <ChevronDown className="inline w-3 h-3" />
              ))}
          </th>
          <th
            className="px-2 py-1 text-left font-semibold cursor-pointer select-none"
            onClick={() => onSort("gdd")}
          >
            GDD Model{" "}
            {sortBy === "gdd" &&
              (sortDir === "asc" ? (
                <ChevronUp className="inline w-3 h-3" />
              ) : (
                <ChevronDown className="inline w-3 h-3" />
              ))}
          </th>
          <th className="px-2 py-1 text-left font-semibold">Edit</th>
          <th className="px-2 py-1 text-left font-semibold">Delete</th>
        </tr>
      </thead>
      <tbody>
        {applications.map((app: any, idx: number) => (
          <tr
            key={app.id}
            className={
              "border-b last:border-b-0 group hover:bg-muted/50 dark:hover:bg-gray-800 " +
              (idx % 2 === 0
                ? "bg-white dark:bg-gray-800"
                : "bg-muted/30 dark:bg-gray-900")
            }
          >
            <td className="px-2 py-1 border-b whitespace-nowrap font-medium">
              {app.application_date}
            </td>
            <td className="px-2 py-1 border-b whitespace-nowrap">
              {lawnMap[app.lawn_id]?.location?.name || ""}
            </td>
            <td className="px-2 py-1 border-b whitespace-nowrap">
              {lawnMap[app.lawn_id]?.name || app.lawn_id}
            </td>
            <td className="px-2 py-1 border-b whitespace-nowrap">
              {productMap[app.product_id]?.name || app.product_id}
            </td>
            <td className="px-2 py-1 border-b whitespace-nowrap">
              {app.amount_per_area} {app.unit} / {app.area_unit} sq ft
            </td>
            <td className="px-2 py-1 border-b whitespace-nowrap capitalize">
              {app.status}
            </td>
            <td className="px-2 py-1 border-b whitespace-nowrap">
              {app.notes}
            </td>
            <td className="px-2 py-1 border-b whitespace-nowrap">
              {app.tied_gdd_model_id
                ? gddModelMap[app.tied_gdd_model_id]?.name ||
                  app.tied_gdd_model_id
                : ""}
            </td>
            <td className="px-2 py-1 text-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onEdit(app)}
                aria-label="Edit"
              >
                <PencilIcon className="w-4 h-4" />
              </Button>
            </td>
            <td className="px-2 py-1 text-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onDelete(app)}
                aria-label="Delete"
              >
                <Trash2Icon className="w-4 h-4 text-destructive" />
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

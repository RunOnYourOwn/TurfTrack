import React from "react";
import { Button } from "@/components/ui/button";
import { PencilIcon, Trash2Icon, ChevronUp, ChevronDown } from "lucide-react";
import type { Lawn } from "@/types/lawn";

interface LawnsTableProps {
  lawns: Lawn[];
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
  onEdit: (lawn: Lawn) => void;
  onDelete: (lawn: Lawn) => void;
}

export const LawnsTable: React.FC<LawnsTableProps> = ({
  lawns,
  sortBy,
  sortDir,
  onSort,
  onEdit,
  onDelete,
}) => (
  <div className="overflow-x-auto">
    <table className="w-full border-collapse rounded-lg bg-background dark:bg-gray-900 text-sm text-black dark:text-white align-middle border-b border-muted-foreground">
      <thead>
        <tr className="bg-muted">
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
            onClick={() => onSort("area")}
          >
            Area{" "}
            {sortBy === "area" &&
              (sortDir === "asc" ? (
                <ChevronUp className="inline w-3 h-3" />
              ) : (
                <ChevronDown className="inline w-3 h-3" />
              ))}
          </th>
          <th
            className="px-4 py-2 text-left font-semibold cursor-pointer select-none"
            onClick={() => onSort("grass_type")}
          >
            Grass Type{" "}
            {sortBy === "grass_type" &&
              (sortDir === "asc" ? (
                <ChevronUp className="inline w-3 h-3" />
              ) : (
                <ChevronDown className="inline w-3 h-3" />
              ))}
          </th>
          <th
            className="px-4 py-2 text-center font-semibold cursor-pointer select-none"
            onClick={() => onSort("weather_enabled")}
          >
            Weather Enabled{" "}
            {sortBy === "weather_enabled" &&
              (sortDir === "asc" ? (
                <ChevronUp className="inline w-3 h-3" />
              ) : (
                <ChevronDown className="inline w-3 h-3" />
              ))}
          </th>
          <th className="px-4 py-2 text-left font-semibold">Notes</th>
          <th className="px-4 py-2 text-center font-semibold">Edit</th>
          <th className="px-4 py-2 text-center font-semibold">Delete</th>
        </tr>
      </thead>
      <tbody>
        {lawns.map((lawn, idx) => {
          const isLast = idx === lawns.length - 1;
          return (
            <tr
              key={lawn.id}
              className={
                "group hover:bg-muted/50 dark:hover:bg-gray-800 align-middle " +
                (idx % 2 === 0
                  ? "bg-white dark:bg-gray-800"
                  : "bg-muted/30 dark:bg-gray-900")
              }
            >
              <td
                className={`px-4 py-2 whitespace-nowrap align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {lawn.location?.name || ""}
              </td>
              <td
                className={`px-4 py-2 whitespace-nowrap font-medium align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {lawn.name}
              </td>
              <td
                className={`px-4 py-2 whitespace-nowrap align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {lawn.area}
              </td>
              <td
                className={`px-4 py-2 whitespace-nowrap capitalize align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {lawn.grass_type.replace("_", " ")}
              </td>
              <td
                className={`px-4 py-2 whitespace-nowrap text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {lawn.weather_enabled ? "✅" : "❌"}
              </td>
              <td
                className={`px-4 py-2 whitespace-nowrap align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {lawn.notes}
              </td>
              <td
                className={`px-4 py-2 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onEdit(lawn)}
                  aria-label="Edit"
                >
                  <PencilIcon className="w-4 h-4" />
                </Button>
              </td>
              <td
                className={`px-4 py-2 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onDelete(lawn)}
                  aria-label="Delete"
                >
                  <Trash2Icon className="w-4 h-4 text-destructive" />
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

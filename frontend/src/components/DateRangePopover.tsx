import React, { useState, useRef } from "react";
import { DateRange } from "react-date-range";
import {
  startOfYear,
  endOfYear,
  startOfMonth,
  endOfMonth,
  subYears,
  subMonths,
  format,
} from "date-fns";

interface DateRangePopoverProps {
  dateRange: { start: string; end: string } | null;
  setDateRange: (r: { start: string; end: string } | null) => void;
  onAllTime?: () => void;
}

const DateRangePopover: React.FC<DateRangePopoverProps> = ({
  dateRange,
  setDateRange,
  onAllTime,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Convert string dates to Date objects for react-date-range
  const selectionRange = {
    startDate: dateRange?.start ? new Date(dateRange.start) : null,
    endDate: dateRange?.end ? new Date(dateRange.end) : null,
    key: "selection",
  };
  // Preset ranges
  const now = new Date();
  const presets = [
    {
      label: "Year to Date",
      range: {
        start: format(startOfYear(now), "yyyy-MM-dd"),
        end: format(now, "yyyy-MM-dd"),
      },
    },
    {
      label: "Last Year",
      range: {
        start: format(startOfYear(subYears(now, 1)), "yyyy-MM-dd"),
        end: format(endOfYear(subYears(now, 1)), "yyyy-MM-dd"),
      },
    },
    {
      label: "This Month",
      range: {
        start: format(startOfMonth(now), "yyyy-MM-dd"),
        end: format(now, "yyyy-MM-dd"),
      },
    },
    {
      label: "Last Month",
      range: {
        start: format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd"),
        end: format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd"),
      },
    },
    {
      label: "All Time",
      range: null,
    },
  ];
  // Format display value
  const display =
    dateRange?.start && dateRange?.end
      ? `${format(new Date(dateRange.start), "MMM d, yyyy")} - ${format(
          new Date(dateRange.end),
          "MMM d, yyyy"
        )}`
      : "Select range";
  // Handle outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="border rounded px-2 py-1 w-full text-left bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-700 min-h-[36px]"
        onClick={() => setOpen((o) => !o)}
      >
        {display}
      </button>
      {open && (
        <div
          className="absolute z-50 mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg p-4 text-black dark:text-white"
          style={{ minWidth: 320 }}
        >
          <DateRange
            ranges={[
              {
                startDate: selectionRange.startDate || new Date(),
                endDate: selectionRange.endDate || new Date(),
                key: "selection",
              },
            ]}
            onChange={(ranges: any) => {
              const sel = ranges.selection;
              setDateRange({
                start: format(sel.startDate, "yyyy-MM-dd"),
                end: format(sel.endDate, "yyyy-MM-dd"),
              });
            }}
            moveRangeOnFirstSelection={false}
            showSelectionPreview={true}
            editableDateInputs={true}
            rangeColors={["#2563eb"]}
            direction="vertical"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {presets.map((preset) => {
              const isAllTime = preset.label === "All Time";
              return (
                <button
                  key={preset.label}
                  type="button"
                  className="text-xs px-2 py-1 rounded border bg-muted dark:bg-gray-700 dark:text-white hover:bg-muted/70 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-700"
                  onClick={() => {
                    if (isAllTime && onAllTime) {
                      onAllTime();
                    } else if (preset.range) setDateRange(preset.range);
                    else setDateRange(null);
                    setOpen(false);
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
            {(dateRange?.start || dateRange?.end) && (
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border bg-muted dark:bg-gray-700 dark:text-white hover:bg-muted/70 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-700"
                onClick={() => {
                  setDateRange(null);
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePopover;

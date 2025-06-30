import Select from "react-select";
import { selectStyles } from "@/lib/selectStyles";
import { NUTRIENTS } from "@/lib/nutrients";
import DateRangePopover from "../DateRangePopover";

interface ReportsFiltersProps {
  lawns: any[];
  lawnsLoading: boolean;
  selectedLawn: string;
  setSelectedLawn: (lawn: string) => void;
  dateRange: { start: string; end: string } | null;
  setDateRange: (range: { start: string; end: string } | null) => void;
  selectedNutrients: string[];
  setSelectedNutrients: (nutrients: string[]) => void;
}

export function ReportsFilters({
  lawns,
  lawnsLoading,
  selectedLawn,
  setSelectedLawn,
  dateRange,
  setDateRange,
  selectedNutrients,
  setSelectedNutrients,
}: ReportsFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6 items-stretch w-full">
      {/* Lawn selector */}
      <div className="w-full md:min-w-[180px] md:flex-1">
        <label className="block text-sm font-medium mb-1">Lawn</label>
        <Select
          isSearchable
          options={
            Array.isArray(lawns)
              ? lawns.map((l: any) => ({
                  value: String(l.id),
                  label: l.name,
                }))
              : []
          }
          value={
            Array.isArray(lawns)
              ? lawns
                  .filter((l: any) => String(l.id) === selectedLawn)
                  .map((l: any) => ({
                    value: String(l.id),
                    label: l.name,
                  }))
              : []
          }
          onChange={(opt: any) => setSelectedLawn(opt?.value)}
          isDisabled={lawnsLoading}
          classNamePrefix="react-select"
          styles={selectStyles}
          menuPlacement="auto"
          placeholder="Select lawn..."
        />
      </div>

      {/* Date range picker */}
      <div className="w-full md:min-w-[260px] md:flex-1 relative">
        <label className="block text-sm font-medium mb-1">Date Range</label>
        <DateRangePopover dateRange={dateRange} setDateRange={setDateRange} />
      </div>

      {/* Nutrient multi-select */}
      <div className="w-full md:min-w-[180px] md:flex-1">
        <label className="block text-sm font-medium mb-1">Nutrients</label>
        <Select
          isMulti
          options={NUTRIENTS.map((n) => ({
            value: n.field,
            label: n.label,
          }))}
          value={NUTRIENTS.filter((n) =>
            selectedNutrients.includes(n.field)
          ).map((n) => ({ value: n.field, label: n.label }))}
          onChange={(opts) =>
            setSelectedNutrients(opts.map((o: any) => o.value))
          }
          classNamePrefix="react-select"
          styles={selectStyles}
          menuPlacement="auto"
          placeholder="Select nutrients..."
        />
      </div>
    </div>
  );
}

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { GDDChart } from "./GDDChart";

const TrashIcon = () => (
  <svg
    width="16"
    height="16"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    className="text-destructive hover:text-destructive/80"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 7h12M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m3 0v12a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12z"
    />
  </svg>
);

interface GDDDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: any;
  parameterHistory: any[];
  gddValues: any[];
  resetHistory: any[];
  selectedRun: number | null;
  onSelectRun: (run: number) => void;
  onEditParameters: () => void;
  onManualReset: () => void;
  onDeleteModel: () => void;
  onDeleteReset: (resetId: number) => void;
  chartData: any[];
}

export const GDDDetailsSheet: React.FC<GDDDetailsSheetProps> = ({
  open,
  onOpenChange,
  model,
  parameterHistory,
  gddValues,
  resetHistory,
  selectedRun,
  onSelectRun,
  onEditParameters,
  onManualReset,
  onDeleteModel,
  onDeleteReset,
  chartData,
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent className="w-full max-w-[95vw] md:w-[800px] md:max-w-[800px] overflow-y-auto p-2 md:p-6 rounded-none md:rounded-lg">
      <div className="flex items-center justify-between gap-4 pt-4 px-6 mb-4">
        <div>
          <SheetTitle>{model?.name}</SheetTitle>
          <SheetDescription>GDD Model Details and History</SheetDescription>
        </div>
        <SheetClose asChild>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteModel}
            className="ml-2 mr-12"
          >
            Delete Model
          </Button>
        </SheetClose>
      </div>
      <div className="space-y-6 px-6">
        {/* Model Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Model Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">
                Base Temperature:
              </div>
              <div className="text-sm font-medium">{model?.base_temp}°C</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Threshold:</div>
              <div className="text-sm font-medium">{model?.threshold}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">
                Reset on Threshold:
              </div>
              <div className="text-sm font-medium">
                {model?.reset_on_threshold ? "Yes" : "No"}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Start Date:</div>
              <div className="text-sm font-medium">
                {model?.start_date
                  ? format(new Date(model.start_date), "MMM dd, yyyy")
                  : "N/A"}
              </div>
            </div>
          </div>
        </div>
        {/* Parameter History */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Parameter History</h3>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={onEditParameters}
            >
              Edit Parameters
            </Button>
          </div>
          {parameterHistory && parameterHistory.length > 0 ? (
            <div className="space-y-3">
              {parameterHistory.map((param, index) => (
                <div
                  key={index}
                  className="rounded-lg border bg-card p-4 text-card-foreground"
                >
                  <div className="mb-2 text-sm text-muted-foreground">
                    Effective from{" "}
                    {param.effective_from
                      ? format(new Date(param.effective_from), "MMM dd, yyyy")
                      : "N/A"}
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Base Temp: </span>
                      {param.base_temp}°C
                    </div>
                    <div>
                      <span className="text-muted-foreground">Threshold: </span>
                      {param.threshold}
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Reset on Threshold:{" "}
                      </span>
                      {param.reset_on_threshold ? "Yes" : "No"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No parameter changes recorded
            </div>
          )}
        </div>
        {/* GDD Values Table and Chart */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">GDD Values</h3>
          {gddValues && gddValues.length > 0 && (
            <div className="overflow-x-auto mb-4">
              <table className="text-xs border-collapse border w-full bg-card text-card-foreground rounded-lg shadow">
                <thead>
                  <tr>
                    <th className="border px-2 py-1 text-center">Date</th>
                    <th className="border px-2 py-1 text-center">Daily GDD</th>
                    <th className="border px-2 py-1 text-center">
                      Cumulative GDD
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gddValues.map((v: any, i: number) => (
                    <tr key={v.id || i}>
                      <td className="border px-2 py-1 text-center">{v.date}</td>
                      <td className="border px-2 py-1 text-center">
                        {Number(v.daily_gdd).toFixed(2)}
                      </td>
                      <td className="border px-2 py-1 text-center">
                        {Number(v.cumulative_gdd).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <GDDChart
            chartData={chartData}
            model={model}
            selectedRun={selectedRun}
            onManualReset={onManualReset}
          />
        </div>
        {/* Reset History */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Reset History</h3>
          <div className="rounded-lg border">
            <div className="divide-y">
              {resetHistory?.map((reset: any) => (
                <div
                  key={reset.id}
                  className={cn(
                    "flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50",
                    selectedRun === reset.run_number && "bg-accent"
                  )}
                  onClick={() => onSelectRun(reset.run_number)}
                >
                  <div className="space-y-1">
                    <div className="text-sm font-medium">
                      Run {reset.run_number}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {reset.reset_date
                        ? format(new Date(reset.reset_date), "MMM dd, yyyy")
                        : "N/A"}{" "}
                      - {reset.reset_type}
                    </div>
                  </div>
                  {reset.reset_type === "manual" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteReset(reset.id);
                      }}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
);

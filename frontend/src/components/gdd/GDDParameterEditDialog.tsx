import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GDDParameterEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedModel: any;
  parameterEditForm: {
    base_temp: string;
    threshold: string;
    reset_on_threshold: boolean;
    effective_from: string;
    recalculate_history: boolean;
  };
  parameterEditSubmitting: boolean;
  parameterEditError: string | null;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function GDDParameterEditDialog({
  open,
  onOpenChange,
  selectedModel,
  parameterEditForm,
  parameterEditSubmitting,
  parameterEditError,
  onInputChange,
  onSubmit,
}: GDDParameterEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit GDD Parameters</DialogTitle>
          <DialogDescription>
            Update the GDD model parameters. You can choose to apply changes
            forward-looking only or recalculate historical data.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium mb-1"
              htmlFor="param_base_temp"
            >
              Base Temperature (leave empty to keep current)
            </label>
            <Input
              id="param_base_temp"
              name="base_temp"
              type="number"
              step="0.1"
              value={parameterEditForm.base_temp}
              onChange={onInputChange}
              disabled={parameterEditSubmitting}
              placeholder={`Current: ${selectedModel?.base_temp}°${selectedModel?.unit}`}
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-1"
              htmlFor="param_threshold"
            >
              Threshold (leave empty to keep current)
            </label>
            <Input
              id="param_threshold"
              name="threshold"
              type="number"
              step="0.1"
              value={parameterEditForm.threshold}
              onChange={onInputChange}
              disabled={parameterEditSubmitting}
              placeholder={`Current: ${selectedModel?.threshold}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="param_reset_on_threshold"
              name="reset_on_threshold"
              type="checkbox"
              checked={parameterEditForm.reset_on_threshold}
              onChange={onInputChange}
              disabled={parameterEditSubmitting}
              className="h-4 w-4 rounded border-gray-300 focus:ring-primary"
            />
            <label
              htmlFor="param_reset_on_threshold"
              className="text-sm font-medium"
            >
              Reset on Threshold
            </label>
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-1"
              htmlFor="param_effective_from"
            >
              Effective From Date
            </label>
            <Input
              id="param_effective_from"
              name="effective_from"
              type="date"
              value={parameterEditForm.effective_from}
              onChange={onInputChange}
              disabled={parameterEditSubmitting}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="param_recalculate_history"
              name="recalculate_history"
              type="checkbox"
              checked={parameterEditForm.recalculate_history}
              onChange={onInputChange}
              disabled={parameterEditSubmitting}
              className="h-4 w-4 rounded border-gray-300 focus:ring-primary"
            />
            <label
              htmlFor="param_recalculate_history"
              className="text-sm font-medium"
            >
              Recalculate Historical Data
            </label>
          </div>
          <div className="text-sm text-muted-foreground">
            {parameterEditForm.recalculate_history
              ? "This will recalculate all GDD values from the effective date forward using the new parameters."
              : "This will only apply the new parameters to future calculations. Historical data will remain unchanged."}
          </div>
          {parameterEditError && (
            <div className="text-red-500 text-sm">{parameterEditError}</div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={parameterEditSubmitting}>
              {parameterEditSubmitting ? "Updating..." : "Update Parameters"}
            </Button>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                disabled={parameterEditSubmitting}
              >
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { IrrigationEntry } from "../../types/water-management";

const SOURCE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
  { value: "scheduled", label: "Scheduled" },
];

interface IrrigationEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  form: Partial<IrrigationEntry>;
  submitting: boolean;
  error?: string | null;
  onInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  onSourceChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export const IrrigationEntryDialog: React.FC<IrrigationEntryDialogProps> = ({
  open,
  onOpenChange,
  mode,
  form,
  submitting,
  error,
  onInputChange,
  onSourceChange,
  onSubmit,
  onCancel,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {mode === "edit" ? "Edit Irrigation Entry" : "Add Irrigation Entry"}
        </DialogTitle>
        <DialogDescription>
          Fill out the form to {mode === "edit" ? "edit" : "add"} an irrigation
          entry.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            name="date"
            type="date"
            value={form.date || ""}
            onChange={onInputChange}
            required
            disabled={submitting}
          />
        </div>

        <div>
          <Label htmlFor="amount">Amount (inches)</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            value={form.amount || ""}
            onChange={onInputChange}
            required
            disabled={submitting}
          />
        </div>

        <div>
          <Label htmlFor="duration">Duration (minutes)</Label>
          <Input
            id="duration"
            name="duration"
            type="number"
            min="0"
            value={form.duration || ""}
            onChange={onInputChange}
            required
            disabled={submitting}
          />
        </div>

        <div>
          <Label htmlFor="source">Source</Label>
          <Select
            value={form.source || ""}
            onValueChange={onSourceChange}
            disabled={submitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input
            id="notes"
            name="notes"
            value={form.notes || ""}
            onChange={onInputChange}
            disabled={submitting}
            placeholder="Additional notes about this irrigation event"
          />
        </div>

        {error && <div className="text-red-500 text-sm">{error}</div>}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : mode === "edit" ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
);

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

interface GDDManualResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resetDate: string;
  resetSubmitting: boolean;
  resetErrorMsg: string | null;
  onResetDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onManualReset: () => void;
}

export function GDDManualResetDialog({
  open,
  onOpenChange,
  resetDate,
  resetSubmitting,
  resetErrorMsg,
  onResetDateChange,
  onManualReset,
}: GDDManualResetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual GDD Reset</DialogTitle>
          <DialogDescription>
            Enter a date to manually reset the GDD model. This will create a new
            run starting from that date.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium mb-1"
              htmlFor="reset_date"
            >
              Reset Date
            </label>
            <Input
              id="reset_date"
              type="date"
              value={resetDate}
              onChange={onResetDateChange}
              disabled={resetSubmitting}
            />
          </div>
          {resetErrorMsg && (
            <div className="text-red-500 text-sm">{resetErrorMsg}</div>
          )}
          <DialogFooter>
            <Button onClick={onManualReset} disabled={resetSubmitting}>
              {resetSubmitting ? "Resetting..." : "Reset GDD Model"}
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" disabled={resetSubmitting}>
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

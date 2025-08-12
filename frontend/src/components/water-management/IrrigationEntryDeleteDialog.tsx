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
import { IrrigationEntry } from "../../types/water-management";

interface IrrigationEntryDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: IrrigationEntry | null;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}

export const IrrigationEntryDeleteDialog: React.FC<
  IrrigationEntryDeleteDialogProps
> = ({ open, onOpenChange, entry, onConfirm, onCancel, deleting }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete Irrigation Entry</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete this irrigation entry? This action
          cannot be undone.
        </DialogDescription>
      </DialogHeader>

      {entry && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="font-medium">
            {new Date(entry.date).toLocaleDateString()}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {entry.amount.toFixed(2)}" • {entry.duration} min • {entry.source}
          </div>
          {entry.notes && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {entry.notes}
            </div>
          )}
        </div>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </DialogClose>
        <Button
          type="button"
          variant="destructive"
          onClick={onConfirm}
          disabled={deleting}
        >
          {deleting ? "Deleting..." : "Delete"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

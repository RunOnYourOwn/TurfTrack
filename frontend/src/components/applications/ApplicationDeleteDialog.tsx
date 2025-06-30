import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ApplicationDeleteDialogProps {
  open: boolean;
  error: string | null;
  deleting: boolean;
  onCancel: () => void;
  onDelete: () => void;
}

export const ApplicationDeleteDialog: React.FC<
  ApplicationDeleteDialogProps
> = ({ open, error, deleting, onCancel, onDelete }) => (
  <Dialog
    open={open}
    onOpenChange={(open) => {
      if (!open) onCancel();
    }}
  >
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete Application</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete this application? This action cannot
          be undone.
        </DialogDescription>
      </DialogHeader>
      {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
      <div className="flex gap-2 justify-end mt-4">
        <Button variant="ghost" onClick={onCancel} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onDelete} disabled={deleting}>
          {deleting ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);

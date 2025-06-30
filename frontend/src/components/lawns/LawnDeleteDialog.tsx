import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface LawnDeleteDialogProps {
  open: boolean;
  error: string | null;
  loading: boolean;
  onCancel: () => void;
  onDelete: () => void;
}

export const LawnDeleteDialog: React.FC<LawnDeleteDialogProps> = ({
  open,
  error,
  loading,
  onCancel,
  onDelete,
}) => (
  <AlertDialog
    open={open}
    onOpenChange={(open) => {
      if (!open) onCancel();
    }}
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete Lawn</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete this lawn? This action cannot be
          undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={loading} onClick={onCancel}>
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction
          disabled={loading}
          onClick={onDelete}
          className="bg-destructive text-white hover:bg-destructive/90"
        >
          {loading ? "Deleting..." : "Delete"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

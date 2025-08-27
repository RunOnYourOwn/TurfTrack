import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetcher } from "@/lib/fetcher";
import { MowerRead } from "@/types/mower";

interface MowerDeleteDialogProps {
  mower: MowerRead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function MowerDeleteDialog({
  mower,
  open,
  onOpenChange,
  onSuccess,
}: MowerDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      await fetcher(`/api/v1/mowers/${mower.id}`, { method: "DELETE" });
      onSuccess();
    } catch (err: any) {
      setError(
        err.response?.data?.detail || err.message || "Failed to delete mower"
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Mower</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="text-center">
            <p className="text-muted-foreground mb-2">
              Are you sure you want to delete this mower?
            </p>
            <div className="bg-muted p-3 rounded-md">
              <div className="font-medium">{mower.name}</div>
              {mower.brand && mower.model && (
                <div className="text-sm text-muted-foreground">
                  {mower.brand} {mower.model}
                  {mower.year && ` (${mower.year})`}
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                Location: {mower.location.name}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              This action cannot be undone. All associated mowing logs and
              maintenance records will also be deleted.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

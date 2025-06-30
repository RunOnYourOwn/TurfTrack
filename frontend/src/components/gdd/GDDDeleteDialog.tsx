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

interface GDDDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedModel: any;
  deleting: boolean;
  onDeleteModel: () => void;
}

export function GDDDeleteDialog({
  open,
  onOpenChange,
  selectedModel,
  deleting,
  onDeleteModel,
}: GDDDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete GDD Model</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the model{" "}
            <span className="font-semibold">{selectedModel?.name}</span>? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={onDeleteModel}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete Model"}
          </Button>
          <DialogClose asChild>
            <Button variant="ghost" disabled={deleting}>
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

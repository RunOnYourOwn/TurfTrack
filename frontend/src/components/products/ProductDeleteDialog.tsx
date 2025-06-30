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

interface ProductDeleteDialogProps {
  deleteProduct: any | null;
  onDelete: () => Promise<void>;
  onClose: () => void;
  deleting: boolean;
  error: string | null;
}

export function ProductDeleteDialog({
  deleteProduct,
  onDelete,
  onClose,
  deleting,
  error,
}: ProductDeleteDialogProps) {
  return (
    <Dialog
      open={!!deleteProduct}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Product</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold">{deleteProduct?.name}</span>? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
        <DialogFooter>
          <Button variant="destructive" onClick={onDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
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

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProductForm } from "../ProductForm";
import { ProductFormValues } from "@/types/product";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProduct: any | null;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  submitting: boolean;
  error: string | null;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  editProduct,
  onSubmit,
  submitting,
  error,
}: ProductFormDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          // Reset edit product when dialog closes
          onOpenChange(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="default"
          size="sm"
          onClick={() => {
            onOpenChange(true);
          }}
          className="w-full md:w-auto"
        >
          + Add Product
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editProduct ? "Edit Product" : "Add Product"}
          </DialogTitle>
          <DialogDescription>
            {editProduct
              ? "Update the product details."
              : "Fill out the form to add a new product."}
          </DialogDescription>
        </DialogHeader>
        <ProductForm
          initialValues={editProduct || {}}
          mode={editProduct ? "edit" : "add"}
          submitting={submitting}
          error={error}
          onSubmit={onSubmit}
          onCancel={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

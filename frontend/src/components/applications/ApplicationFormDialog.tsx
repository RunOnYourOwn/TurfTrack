import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ApplicationForm } from "@/components/applications/ApplicationForm";

interface ApplicationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues: any;
  mode: "add" | "edit";
  lawns: any[];
  products: any[];
  gddModels: any[];
  submitting: boolean;
  error: string | null;
  onSubmit: (values: any) => void;
  onCancel: () => void;
}

export const ApplicationFormDialog: React.FC<ApplicationFormDialogProps> = ({
  open,
  onOpenChange,
  initialValues,
  mode,
  lawns,
  products,
  gddModels,
  submitting,
  error,
  onSubmit,
  onCancel,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {mode === "edit" ? "Edit Application" : "Add Application"}
        </DialogTitle>
        <DialogDescription>
          Fill out the form to {mode === "edit" ? "edit" : "add"} an
          application.
        </DialogDescription>
      </DialogHeader>
      <ApplicationForm
        initialValues={initialValues}
        mode={mode}
        submitting={submitting}
        error={error}
        lawns={lawns}
        products={products}
        gddModels={gddModels}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    </DialogContent>
  </Dialog>
);

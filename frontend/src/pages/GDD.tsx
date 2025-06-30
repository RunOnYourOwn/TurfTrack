import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "../lib/fetcher";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { toast } from "sonner";
import { GDDTable } from "@/components/gdd/GDDTable";
import { GDDForm } from "@/components/gdd/GDDForm";
import { GDDDetailsSheet } from "@/components/gdd/GDDDetailsSheet";
import { GDDParameterEditDialog } from "@/components/gdd/GDDParameterEditDialog";
import { GDDManualResetDialog } from "@/components/gdd/GDDManualResetDialog";
import { GDDDeleteDialog } from "@/components/gdd/GDDDeleteDialog";

export default function GDD() {
  const queryClient = useQueryClient();
  const [selectedLocationId, setSelectedLocationId] = React.useState<
    string | null
  >(null);

  // Add GDD Model modal state
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    base_temp: "",
    unit: "C",
    start_date: "",
    threshold: "",
    reset_on_threshold: false,
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Fetch locations for dropdown
  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: () => fetcher("/api/v1/locations/"),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch GDD models for selected location
  const {
    data: gddModels,
    isLoading: gddLoading,
    error: gddError,
  } = useQuery({
    queryKey: ["gddModels", selectedLocationId],
    queryFn: () =>
      selectedLocationId
        ? fetcher(`/api/v1/gdd_models/location/${selectedLocationId}`)
        : Promise.resolve([]),
    enabled: !!selectedLocationId,
    staleTime: 5 * 60 * 1000,
  });

  const [selectedModel, setSelectedModel] = React.useState<any | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // Fetch reset history for the selected model
  const { data: resetHistory } = useQuery({
    queryKey: ["gddResets", selectedModel?.id],
    queryFn: () =>
      selectedModel?.id
        ? fetcher(`/api/v1/gdd_models/${selectedModel.id}/resets`)
        : Promise.resolve([]),
    enabled: !!selectedModel,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch parameter history for the selected model
  const { data: parameterHistory } = useQuery({
    queryKey: ["gddParameterHistory", selectedModel?.id],
    queryFn: () =>
      selectedModel?.id
        ? fetcher(`/api/v1/gdd_models/${selectedModel.id}/history`)
        : Promise.resolve(null),
    enabled: !!selectedModel,
    staleTime: 5 * 60 * 1000,
  });

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetDate, setResetDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetErrorMsg, setResetErrorMsg] = useState<string | null>(null);

  const [selectedRun, setSelectedRun] = useState<number | null>(null);

  // Ensure selectedRun is always valid after resetHistory changes
  React.useEffect(() => {
    if (sheetOpen && resetHistory && resetHistory.length > 0) {
      // If the current selectedRun is not in the new resetHistory, default to the latest run
      const runNumbers = resetHistory.map((r: any) => r.run_number);
      if (!selectedRun || !runNumbers.includes(selectedRun)) {
        setSelectedRun(resetHistory[resetHistory.length - 1].run_number);
      }
    }
  }, [sheetOpen, resetHistory]);

  // Fetch GDD values for the selected run
  const { data: gddValues } = useQuery({
    queryKey: ["gddValues", selectedModel?.id, selectedRun],
    queryFn: () =>
      selectedModel?.id && selectedRun != null
        ? fetcher(
            `/api/v1/gdd_models/${selectedModel.id}/runs/${selectedRun}/values`
          )
        : Promise.resolve([]),
    enabled: !!selectedModel && selectedRun != null,
    staleTime: 5 * 60 * 1000,
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Parameter editing state
  const [parameterEditDialogOpen, setParameterEditDialogOpen] = useState(false);
  const [parameterEditForm, setParameterEditForm] = useState({
    base_temp: "",
    threshold: "",
    reset_on_threshold: false,
    recalculate_history: false,
    effective_from: format(new Date(), "yyyy-MM-dd"),
  });
  const [parameterEditSubmitting, setParameterEditSubmitting] = useState(false);
  const [parameterEditError, setParameterEditError] = useState<string | null>(
    null
  );

  // Nivo data transformation for cumulative GDD
  const nivoData = React.useMemo(
    () => [
      {
        id: "Cumulative GDD",
        data: (gddValues || [])
          .filter((v: any) => v.date && v.cumulative_gdd != null)
          .map((v: any) => ({
            x: v.date,
            y: v.cumulative_gdd,
          })),
      },
    ],
    [gddValues]
  );

  // Responsive Nivo chart margins and font size
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleUnitChange(value: string) {
    setForm((f) => ({ ...f, unit: value }));
  }

  function handleParameterEditInputChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const { name, value, type, checked } = e.target;
    setParameterEditForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      if (!selectedLocationId) {
        setFormError("Please select a location.");
        setSubmitting(false);
        return;
      }
      await fetcher("/api/v1/gdd_models/", {
        method: "POST",
        data: {
          name: form.name,
          base_temp: Number(form.base_temp),
          unit: form.unit,
          start_date: form.start_date,
          threshold: Number(form.threshold),
          reset_on_threshold: form.reset_on_threshold,
          location_id: Number(selectedLocationId),
        },
      });
      setOpen(false);
      setForm({
        name: "",
        base_temp: "",
        unit: "C",
        start_date: "",
        threshold: "",
        reset_on_threshold: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["gddModels", selectedLocationId],
      });
    } catch (err: any) {
      setFormError(err.message || "Failed to add GDD model");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleParameterEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setParameterEditSubmitting(true);
    setParameterEditError(null);

    try {
      if (!selectedModel) {
        throw new Error("No model selected");
      }

      const updateData: any = {};
      if (parameterEditForm.base_temp) {
        updateData.base_temp = Number(parameterEditForm.base_temp);
      }
      if (parameterEditForm.threshold) {
        updateData.threshold = Number(parameterEditForm.threshold);
      }
      updateData.reset_on_threshold = parameterEditForm.reset_on_threshold;
      updateData.recalculate_history = parameterEditForm.recalculate_history;
      updateData.effective_from = parameterEditForm.effective_from;

      await fetcher(`/api/v1/gdd_models/${selectedModel.id}/parameters`, {
        method: "PUT",
        data: updateData,
      });

      // Reset form
      setParameterEditForm({
        base_temp: "",
        threshold: "",
        reset_on_threshold: false,
        recalculate_history: false,
        effective_from: format(new Date(), "yyyy-MM-dd"),
      });
      setParameterEditDialogOpen(false);

      // Refresh data
      queryClient.invalidateQueries({
        queryKey: ["gddModels", selectedLocationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["gddParameterHistory", selectedModel.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["gddValues", selectedModel.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["gddResets", selectedModel.id],
      });

      toast.success("GDD parameters updated successfully");
    } catch (err: any) {
      setParameterEditError(err.message || "Failed to update GDD parameters");
    } finally {
      setParameterEditSubmitting(false);
    }
  }

  async function handleManualReset() {
    if (!selectedModel) return;
    setResetSubmitting(true);
    setResetErrorMsg(null);
    try {
      await fetcher(
        `/api/v1/gdd_models/${selectedModel.id}/reset?reset_date=${resetDate}`,
        {
          method: "POST",
        }
      );
      setResetDialogOpen(false);
      // Refresh reset history and GDD values
      await queryClient.invalidateQueries({
        queryKey: ["gddResets", selectedModel.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["gddValues", selectedModel.id, selectedRun],
      });
      await queryClient.invalidateQueries({
        queryKey: ["gddModels", selectedLocationId],
      });
      toast.success("GDD model reset successfully");
    } catch (err: any) {
      setResetErrorMsg(err.message || "Failed to reset GDD model");
    } finally {
      setResetSubmitting(false);
    }
  }

  async function handleDeleteModel() {
    if (!selectedModel) return;
    setDeleting(true);
    try {
      await fetcher(`/api/v1/gdd_models/${selectedModel.id}`, {
        method: "DELETE",
      });
      setDeleteDialogOpen(false);
      setSheetOpen(false);
      setSelectedModel(null);
      queryClient.invalidateQueries({
        queryKey: ["gddModels", selectedLocationId],
      });
      toast.success("GDD model deleted successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete GDD model");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteReset(resetId: number) {
    try {
      await fetcher(
        `/api/v1/gdd_models/${selectedModel?.id}/resets/${resetId}`,
        {
          method: "DELETE",
        }
      );
      toast.success("Reset deleted and GDD values recalculated.");
      queryClient.invalidateQueries({
        queryKey: ["gddResets", selectedModel?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["gddValues", selectedModel?.id, selectedRun],
      });
      queryClient.invalidateQueries({
        queryKey: ["gddModels", selectedLocationId],
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete reset.");
    }
  }

  // Chart configuration

  return (
    <div className="p-4 min-h-screen bg-background w-full">
      <Card className="min-h-[400px] w-full shadow-lg bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle className="text-2xl font-bold">GDD Models</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                variant="default"
                size="sm"
                disabled={!selectedLocationId}
              >
                + Add GDD Model
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add GDD Model</DialogTitle>
                <DialogDescription>
                  Fill out the form to add a new GDD model for this location.
                </DialogDescription>
              </DialogHeader>
              <GDDForm
                form={form}
                onChange={handleInputChange}
                onUnitChange={handleUnitChange}
                onSubmit={handleSubmit}
                submitting={submitting}
                formError={formError}
                onCancel={() => setOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {/* Location Dropdown */}
          <div className="mb-4 flex items-center gap-4">
            <span className="font-medium">Location:</span>
            <Select
              value={selectedLocationId || ""}
              onValueChange={setSelectedLocationId}
              disabled={locationsLoading || !locations}
            >
              <SelectTrigger className="w-64">
                <SelectValue
                  placeholder={
                    locationsLoading ? "Loading..." : "Select a location"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {locations && locations.length > 0 ? (
                  locations.map((location: any) => (
                    <SelectItem key={location.id} value={String(location.id)}>
                      {location.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-4 py-2 text-muted-foreground">
                    No locations found
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          {/* GDD Models Table */}
          <GDDTable
            gddModels={gddModels || []}
            loading={gddLoading}
            error={gddError}
            onSelectModel={(model) => {
              setSelectedModel(model);
              setSheetOpen(true);
            }}
          />
        </CardContent>
      </Card>

      {/* Model Details Sheet */}
      <GDDDetailsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        model={selectedModel}
        parameterHistory={parameterHistory || []}
        gddValues={gddValues || []}
        resetHistory={resetHistory || []}
        selectedRun={selectedRun}
        onSelectRun={setSelectedRun}
        onEditParameters={() => setParameterEditDialogOpen(true)}
        onManualReset={() => setResetDialogOpen(true)}
        onDeleteModel={() => setDeleteDialogOpen(true)}
        onDeleteReset={handleDeleteReset}
        chartData={nivoData}
      />

      {/* Parameter Edit Dialog */}
      <GDDParameterEditDialog
        open={parameterEditDialogOpen}
        onOpenChange={setParameterEditDialogOpen}
        selectedModel={selectedModel}
        parameterEditForm={parameterEditForm}
        parameterEditSubmitting={parameterEditSubmitting}
        parameterEditError={parameterEditError}
        onInputChange={handleParameterEditInputChange}
        onSubmit={handleParameterEditSubmit}
      />

      {/* Manual Reset Dialog */}
      <GDDManualResetDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        resetDate={resetDate}
        resetSubmitting={resetSubmitting}
        resetErrorMsg={resetErrorMsg}
        onResetDateChange={(e) => setResetDate(e.target.value)}
        onManualReset={handleManualReset}
      />

      {/* Delete Model Dialog */}
      <GDDDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        selectedModel={selectedModel}
        deleting={deleting}
        onDeleteModel={handleDeleteModel}
      />
    </div>
  );
}

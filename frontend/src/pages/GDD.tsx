import React from "react";
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
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { useState } from "react";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { toast } from "sonner";
import { PencilIcon, HistoryIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TrashIcon = () => (
  <svg
    width="16"
    height="16"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    className="text-destructive hover:text-destructive/80"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 7h12M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m3 0v12a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12z"
    />
  </svg>
);

export default function GDD() {
  const queryClient = useQueryClient();
  const [selectedLawnId, setSelectedLawnId] = React.useState<string | null>(
    null
  );

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

  // Fetch lawns for dropdown
  const {
    data: lawns,
    isLoading: lawnsLoading,
    error: lawnsError,
  } = useQuery({
    queryKey: ["lawns"],
    queryFn: () => fetcher("/api/v1/lawns/"),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch GDD models for selected lawn
  const {
    data: gddModels,
    isLoading: gddLoading,
    error: gddError,
  } = useQuery({
    queryKey: ["gddModels", selectedLawnId],
    queryFn: () =>
      selectedLawnId
        ? fetcher(`/api/v1/gdd_models/lawn/${selectedLawnId}`)
        : Promise.resolve([]),
    enabled: !!selectedLawnId,
    staleTime: 5 * 60 * 1000,
  });

  const [selectedModel, setSelectedModel] = React.useState<any | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // Fetch reset history for the selected model
  const {
    data: resetHistory,
    isLoading: resetLoading,
    error: resetError,
  } = useQuery({
    queryKey: ["gddResets", selectedModel?.id],
    queryFn: () =>
      selectedModel?.id
        ? fetcher(`/api/v1/gdd_models/${selectedModel.id}/resets`)
        : Promise.resolve([]),
    enabled: !!selectedModel,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch parameter history for the selected model
  const {
    data: parameterHistory,
    isLoading: paramHistoryLoading,
    error: paramHistoryError,
  } = useQuery({
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
  const {
    data: gddValues,
    isLoading: gddValuesLoading,
    error: gddValuesError,
  } = useQuery({
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
      if (!selectedLawnId) {
        setFormError("Please select a lawn.");
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
          lawn_id: Number(selectedLawnId),
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
        queryKey: ["gddModels", selectedLawnId],
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
        queryKey: ["gddModels", selectedLawnId],
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
        queryKey: ["gddModels", selectedLawnId],
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
        queryKey: ["gddModels", selectedLawnId],
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
        queryKey: ["gddModels", selectedLawnId],
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete reset.");
    }
  }

  // Chart configuration
  const maxY =
    gddValuesLoading || !gddValues
      ? 100
      : gddValues && gddValues.length > 0
      ? Math.max(...gddValues.map((v: any) => v.cumulative_gdd || 0))
      : 100;
  const step = Math.ceil(maxY / 5 / 10) * 10 || 10; // round to nearest 10
  const ticks = Array.from({ length: 6 }, (_, i) => i * step);

  return (
    <div className="p-4 min-h-screen bg-background w-full">
      <Card className="min-h-[400px] w-full shadow-lg bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle className="text-2xl font-bold">GDD Models</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm" disabled={!selectedLawnId}>
                + Add GDD Model
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add GDD Model</DialogTitle>
                <DialogDescription>
                  Fill out the form to add a new GDD model for this lawn.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    htmlFor="name"
                  >
                    Name
                  </label>
                  <Input
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={handleInputChange}
                    required
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    htmlFor="base_temp"
                  >
                    Base Temp
                  </label>
                  <Input
                    id="base_temp"
                    name="base_temp"
                    type="number"
                    value={form.base_temp}
                    onChange={handleInputChange}
                    required
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    htmlFor="unit"
                  >
                    Unit
                  </label>
                  <Select
                    value={form.unit}
                    onValueChange={handleUnitChange}
                    disabled={submitting}
                  >
                    <SelectTrigger id="unit" name="unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="C">Celsius (°C)</SelectItem>
                      <SelectItem value="F">Fahrenheit (°F)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    htmlFor="start_date"
                  >
                    Start Date
                  </label>
                  <Input
                    id="start_date"
                    name="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={handleInputChange}
                    required
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    htmlFor="threshold"
                  >
                    Threshold
                  </label>
                  <Input
                    id="threshold"
                    name="threshold"
                    type="number"
                    value={form.threshold}
                    onChange={handleInputChange}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="reset_on_threshold"
                    name="reset_on_threshold"
                    type="checkbox"
                    checked={form.reset_on_threshold}
                    onChange={handleInputChange}
                    disabled={submitting}
                    className="h-4 w-4 rounded border-gray-300 focus:ring-primary"
                  />
                  <label
                    htmlFor="reset_on_threshold"
                    className="text-sm font-medium"
                  >
                    Reset on Threshold
                  </label>
                </div>
                {formError && (
                  <div className="text-red-500 text-sm">{formError}</div>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Adding..." : "Add GDD Model"}
                  </Button>
                  <DialogClose asChild>
                    <Button type="button" variant="ghost" disabled={submitting}>
                      Cancel
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {/* Lawn Dropdown */}
          <div className="mb-4 flex items-center gap-4">
            <span className="font-medium">Lawn:</span>
            <Select
              value={selectedLawnId || ""}
              onValueChange={setSelectedLawnId}
              disabled={lawnsLoading || !lawns}
            >
              <SelectTrigger className="w-64">
                <SelectValue
                  placeholder={lawnsLoading ? "Loading..." : "Select a lawn"}
                />
              </SelectTrigger>
              <SelectContent>
                {lawns && lawns.length > 0 ? (
                  lawns.map((lawn: any) => (
                    <SelectItem key={lawn.id} value={String(lawn.id)}>
                      {lawn.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-4 py-2 text-muted-foreground">
                    No lawns found
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          {/* GDD Models Table */}
          {gddLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading GDD models...
            </div>
          ) : gddError ? (
            <div className="py-8 text-center text-red-500">
              Error loading GDD models: {gddError.message}
            </div>
          ) : !gddModels || gddModels.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No GDD models found for this lawn.
            </div>
          ) : (
            <div className="space-y-4">
              {gddModels.map((model: any) => (
                <Card
                  key={model.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setSelectedModel(model);
                    setSheetOpen(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{model.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Base Temp: {model.base_temp}°{model.unit} | Threshold:{" "}
                          {model.threshold} | Reset on Threshold:{" "}
                          {model.reset_on_threshold ? "Yes" : "No"}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Created:{" "}
                        {format(new Date(model.created_at), "MMM d, yyyy")}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Details Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[800px] sm:max-w-[800px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedModel?.name}</SheetTitle>
            <SheetDescription>GDD Model Details and History</SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Model Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Base Temperature:
                  </div>
                  <div className="text-sm font-medium">
                    {selectedModel?.base_temp}°C
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Threshold:
                  </div>
                  <div className="text-sm font-medium">
                    {selectedModel?.threshold}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Reset on Threshold:
                  </div>
                  <div className="text-sm font-medium">
                    {selectedModel?.reset_on_threshold ? "Yes" : "No"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Start Date:
                  </div>
                  <div className="text-sm font-medium">
                    {selectedModel?.start_date
                      ? format(
                          new Date(selectedModel.start_date),
                          "MMM dd, yyyy"
                        )
                      : "N/A"}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Parameter History</h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setParameterEditDialogOpen(true)}
                >
                  <PencilIcon className="mr-2 h-3.5 w-3.5" />
                  Edit Parameters
                </Button>
              </div>
              {parameterHistory && parameterHistory.length > 0 ? (
                <div className="space-y-3">
                  {parameterHistory.map((param: any, index: number) => (
                    <div
                      key={index}
                      className="rounded-lg border bg-card p-4 text-card-foreground"
                    >
                      <div className="mb-2 text-sm text-muted-foreground">
                        Effective from{" "}
                        {param.effective_from
                          ? format(
                              new Date(param.effective_from),
                              "MMM dd, yyyy"
                            )
                          : "N/A"}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">
                            Base Temp:{" "}
                          </span>
                          {param.base_temp}°C
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Threshold:{" "}
                          </span>
                          {param.threshold}
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Reset on Threshold:{" "}
                          </span>
                          {param.reset_on_threshold ? "Yes" : "No"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No parameter changes recorded
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium">GDD Values</h3>
              <div className="rounded-lg border">
                <div className="flex items-center justify-between p-4">
                  <div className="text-sm text-muted-foreground">
                    {selectedRun
                      ? `Showing Run ${selectedRun}`
                      : "Select a run from history below"}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResetDialogOpen(true)}
                  >
                    Manual Reset
                  </Button>
                </div>
                <div className="h-[300px] p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={gddValues || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(date) =>
                          date ? format(new Date(date), "MMM dd") : ""
                        }
                      />
                      <YAxis
                        domain={[
                          0,
                          (dataMax: number) =>
                            Math.max(dataMax, selectedModel?.threshold || 0) *
                            1.1,
                        ]}
                        tickFormatter={(value) => Math.round(value).toString()}
                        ticks={[0, 40, 80, 120, 160, 200, 240, 280, 320]}
                        allowDataOverflow
                      />
                      <Tooltip
                        labelFormatter={(date) =>
                          date ? format(new Date(date), "MMM dd, yyyy") : ""
                        }
                        formatter={(value: any, name: string) => [
                          Number(value).toFixed(1),
                          name === "Daily GDD" ? "Daily GDD" : "Cumulative GDD",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="daily_gdd"
                        stroke="#10b981"
                        dot={false}
                        name="Daily GDD"
                      />
                      <Line
                        type="monotone"
                        dataKey="cumulative_gdd"
                        stroke="#6366f1"
                        dot={false}
                        name="Cumulative GDD"
                        strokeWidth={2}
                      />
                      {gddValues?.[0]?.effective_params?.threshold && (
                        <ReferenceLine
                          y={gddValues[0].effective_params.threshold}
                          stroke="#ef4444"
                          strokeDasharray="3 3"
                          label={{
                            value: `Threshold (${gddValues[0].effective_params.threshold})`,
                            position: "top",
                            fill: "#ef4444",
                            fontSize: 12,
                          }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Reset History</h3>
              <div className="rounded-lg border">
                <div className="divide-y">
                  {resetHistory?.map((reset: any) => (
                    <div
                      key={reset.id}
                      className={cn(
                        "flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50",
                        selectedRun === reset.run_number && "bg-accent"
                      )}
                      onClick={() => setSelectedRun(reset.run_number)}
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          Run {reset.run_number}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {reset.reset_date
                            ? format(new Date(reset.reset_date), "MMM dd, yyyy")
                            : "N/A"}{" "}
                          - {reset.reset_type}
                        </div>
                      </div>
                      {reset.reset_type === "Manual" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteReset(reset.id);
                          }}
                          className="text-destructive hover:text-destructive/80"
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <SheetClose asChild>
            <Button
              variant="destructive"
              className="absolute bottom-6 right-6"
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete Model
            </Button>
          </SheetClose>
        </SheetContent>
      </Sheet>

      {/* Parameter Edit Dialog */}
      <Dialog
        open={parameterEditDialogOpen}
        onOpenChange={setParameterEditDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit GDD Parameters</DialogTitle>
            <DialogDescription>
              Update the GDD model parameters. You can choose to apply changes
              forward-looking only or recalculate historical data.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleParameterEditSubmit} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="param_base_temp"
              >
                Base Temperature (leave empty to keep current)
              </label>
              <Input
                id="param_base_temp"
                name="base_temp"
                type="number"
                step="0.1"
                value={parameterEditForm.base_temp}
                onChange={handleParameterEditInputChange}
                disabled={parameterEditSubmitting}
                placeholder={`Current: ${selectedModel?.base_temp}°${selectedModel?.unit}`}
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="param_threshold"
              >
                Threshold (leave empty to keep current)
              </label>
              <Input
                id="param_threshold"
                name="threshold"
                type="number"
                step="0.1"
                value={parameterEditForm.threshold}
                onChange={handleParameterEditInputChange}
                disabled={parameterEditSubmitting}
                placeholder={`Current: ${selectedModel?.threshold}`}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="param_reset_on_threshold"
                name="reset_on_threshold"
                type="checkbox"
                checked={parameterEditForm.reset_on_threshold}
                onChange={handleParameterEditInputChange}
                disabled={parameterEditSubmitting}
                className="h-4 w-4 rounded border-gray-300 focus:ring-primary"
              />
              <label
                htmlFor="param_reset_on_threshold"
                className="text-sm font-medium"
              >
                Reset on Threshold
              </label>
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="param_effective_from"
              >
                Effective From Date
              </label>
              <Input
                id="param_effective_from"
                name="effective_from"
                type="date"
                value={parameterEditForm.effective_from}
                onChange={handleParameterEditInputChange}
                disabled={parameterEditSubmitting}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="param_recalculate_history"
                name="recalculate_history"
                type="checkbox"
                checked={parameterEditForm.recalculate_history}
                onChange={handleParameterEditInputChange}
                disabled={parameterEditSubmitting}
                className="h-4 w-4 rounded border-gray-300 focus:ring-primary"
              />
              <label
                htmlFor="param_recalculate_history"
                className="text-sm font-medium"
              >
                Recalculate Historical Data
              </label>
            </div>
            <div className="text-sm text-muted-foreground">
              {parameterEditForm.recalculate_history
                ? "This will recalculate all GDD values from the effective date forward using the new parameters."
                : "This will only apply the new parameters to future calculations. Historical data will remain unchanged."}
            </div>
            {parameterEditError && (
              <div className="text-red-500 text-sm">{parameterEditError}</div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={parameterEditSubmitting}>
                {parameterEditSubmitting ? "Updating..." : "Update Parameters"}
              </Button>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={parameterEditSubmitting}
                >
                  Cancel
                </Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manual Reset Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual GDD Reset</DialogTitle>
            <DialogDescription>
              Enter a date to manually reset the GDD model. This will create a
              new run starting from that date.
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
                onChange={(e) => setResetDate(e.target.value)}
                disabled={resetSubmitting}
              />
            </div>
            {resetErrorMsg && (
              <div className="text-red-500 text-sm">{resetErrorMsg}</div>
            )}
            <DialogFooter>
              <Button onClick={handleManualReset} disabled={resetSubmitting}>
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

      {/* Delete Model Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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
              onClick={handleDeleteModel}
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
    </div>
  );
}

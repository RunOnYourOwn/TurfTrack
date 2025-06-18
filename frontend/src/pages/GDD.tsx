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
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { useState } from "react";
import { format } from "date-fns";

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

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetDate, setResetDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetErrorMsg, setResetErrorMsg] = useState<string | null>(null);

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
      queryClient.invalidateQueries({
        queryKey: ["gddResets", selectedModel.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["gddModels", selectedLawnId],
      });
    } catch (err: any) {
      setResetErrorMsg(err.message || "Failed to reset GDD model");
    } finally {
      setResetSubmitting(false);
    }
  }

  return (
    <div className="p-4 min-h-screen bg-muted/50 w-full">
      <Card className="min-h-[400px] w-full shadow-lg">
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
              Error loading GDD models: {(gddError as Error).message}
            </div>
          ) : !gddModels || gddModels.length === 0 ? (
            <div className="flex flex-col items-center">
              <span className="text-4xl mb-2">🌱</span>
              <span className="text-muted-foreground text-lg">
                No GDD models found for this lawn.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 rounded-lg overflow-hidden bg-background">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-4 py-2 text-left font-semibold">Name</th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Base Temp
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">Unit</th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Start Date
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Threshold
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Reset on Threshold
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gddModels.map((model: any, idx: number) => (
                    <tr
                      key={model.id}
                      className={
                        idx % 2 === 0
                          ? "bg-white hover:bg-muted/60 transition cursor-pointer"
                          : "bg-muted/30 hover:bg-muted/60 transition cursor-pointer"
                      }
                      onClick={() => {
                        setSelectedModel(model);
                        setSheetOpen(true);
                      }}
                    >
                      <td className="px-4 py-2 border-b whitespace-nowrap">
                        {model.name}
                      </td>
                      <td className="px-4 py-2 border-b whitespace-nowrap">
                        {model.base_temp}
                      </td>
                      <td className="px-4 py-2 border-b whitespace-nowrap">
                        {model.unit}
                      </td>
                      <td className="px-4 py-2 border-b whitespace-nowrap">
                        {model.start_date}
                      </td>
                      <td className="px-4 py-2 border-b whitespace-nowrap">
                        {model.threshold}
                      </td>
                      <td className="px-4 py-2 border-b whitespace-nowrap text-center">
                        {model.reset_on_threshold ? (
                          <span className="text-green-600 text-xl">
                            &#x2705;
                          </span>
                        ) : (
                          <span className="text-red-600 text-xl">&#x274C;</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* GDD Model Details Drawer */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[480px] max-w-full">
          <SheetHeader>
            <SheetTitle>GDD Model Details</SheetTitle>
            <SheetDescription>
              {selectedModel
                ? `Details for ${selectedModel.name}`
                : "No model selected."}
            </SheetDescription>
          </SheetHeader>
          {selectedModel && (
            <div className="mt-4 space-y-6">
              <section className="bg-muted/50 rounded-lg p-4 shadow">
                <h3 className="text-lg font-semibold mb-2">Model Info</h3>
                <dl className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-medium">{selectedModel.name}</dd>
                  <dt className="text-muted-foreground">Base Temp</dt>
                  <dd>{selectedModel.base_temp}</dd>
                  <dt className="text-muted-foreground">Unit</dt>
                  <dd>{selectedModel.unit}</dd>
                  <dt className="text-muted-foreground">Start Date</dt>
                  <dd>{selectedModel.start_date}</dd>
                  <dt className="text-muted-foreground">Threshold</dt>
                  <dd>{selectedModel.threshold}</dd>
                  <dt className="text-muted-foreground">Reset on Threshold</dt>
                  <dd>{selectedModel.reset_on_threshold ? "Yes" : "No"}</dd>
                </dl>
              </section>
              <section>
                <h3 className="text-lg font-semibold mb-2">Analytics</h3>
                <div className="text-muted-foreground text-center">
                  [GDD Value Graph coming soon]
                </div>
              </section>
              <section className="bg-muted/50 rounded-lg p-4 shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">Reset History</h3>
                  <Dialog
                    open={resetDialogOpen}
                    onOpenChange={setResetDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!selectedModel}
                      >
                        Manual Reset
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Manual Reset</DialogTitle>
                        <DialogDescription>
                          Select a date to manually reset this GDD model. This
                          will start a new run from the selected date.
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleManualReset();
                        }}
                        className="space-y-4"
                      >
                        <div>
                          <label
                            htmlFor="reset_date"
                            className="block text-sm font-medium mb-1"
                          >
                            Reset Date
                          </label>
                          <Input
                            id="reset_date"
                            name="reset_date"
                            type="date"
                            value={resetDate}
                            onChange={(e) => setResetDate(e.target.value)}
                            required
                            disabled={resetSubmitting}
                          />
                        </div>
                        {resetErrorMsg && (
                          <div className="text-red-500 text-sm">
                            {resetErrorMsg}
                          </div>
                        )}
                        <DialogFooter>
                          <Button type="submit" disabled={resetSubmitting}>
                            {resetSubmitting ? "Resetting..." : "Confirm Reset"}
                          </Button>
                          <DialogClose asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={resetSubmitting}
                            >
                              Cancel
                            </Button>
                          </DialogClose>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                {resetLoading ? (
                  <div className="text-muted-foreground text-center">
                    Loading reset history...
                  </div>
                ) : resetError ? (
                  <div className="text-red-500 text-center">
                    Error loading reset history
                  </div>
                ) : !resetHistory || resetHistory.length === 0 ? (
                  <div className="text-muted-foreground text-center">
                    No resets found for this model.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-0 rounded-lg overflow-hidden bg-background text-sm">
                      <thead>
                        <tr className="bg-muted">
                          <th className="px-4 py-2 text-left font-semibold">
                            Date
                          </th>
                          <th className="px-4 py-2 text-left font-semibold">
                            Run #
                          </th>
                          <th className="px-4 py-2 text-left font-semibold">
                            Type
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {resetHistory.map((reset: any, idx: number) => (
                          <tr
                            key={reset.id}
                            className={
                              idx % 2 === 0
                                ? "bg-white hover:bg-muted/60 transition"
                                : "bg-muted/30 hover:bg-muted/60 transition"
                            }
                          >
                            <td className="px-4 py-2 border-b whitespace-nowrap font-medium">
                              {reset.reset_date}
                            </td>
                            <td className="px-4 py-2 border-b whitespace-nowrap">
                              {reset.run_number}
                            </td>
                            <td className="px-4 py-2 border-b whitespace-nowrap capitalize">
                              {reset.reset_type.charAt(0).toUpperCase() +
                                reset.reset_type.slice(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}
          <SheetClose asChild>
            <Button className="absolute top-4 right-4" variant="ghost">
              Close
            </Button>
          </SheetClose>
        </SheetContent>
      </Sheet>
    </div>
  );
}

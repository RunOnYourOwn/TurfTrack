import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "../lib/fetcher";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import * as React from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
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
import type { Lawn } from "../types/lawn";

const WEATHER_FREQ_OPTIONS = [
  { value: "4h", label: "Every 4 hours" },
  { value: "8h", label: "Every 8 hours" },
  { value: "12h", label: "Every 12 hours" },
  { value: "24h", label: "Every 24 hours (Daily)" },
];

// A minimal list of common timezones; for production, use a full IANA list or a package
const TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const GRASS_TYPE_OPTIONS = [
  { value: "cold_season", label: "Cold Season" },
  { value: "warm_season", label: "Warm Season" },
];

export default function Lawns() {
  const queryClient = useQueryClient();
  const {
    data: lawns,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["lawns"],
    queryFn: () => fetcher("/api/v1/lawns/"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Add Lawn modal state
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    area: "",
    grass_type: "cold_season",
    notes: "",
    weather_fetch_frequency: "24h",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    weather_enabled: true,
    latitude: "",
    longitude: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Edit Lawn modal state
  const [editOpen, setEditOpen] = React.useState(false);
  const [editLawn, setEditLawn] = React.useState<Lawn | null>(null);
  const [editForm, setEditForm] = React.useState({
    name: "",
    area: "",
    grass_type: "cold_season",
    notes: "",
    weather_fetch_frequency: "24h",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    weather_enabled: true,
    latitude: "",
    longitude: "",
  });
  const [editSubmitting, setEditSubmitting] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  // Delete Lawn state
  const [deleteLawn, setDeleteLawn] = React.useState<Lawn | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleGrassTypeChange(value: string) {
    setForm((f) => ({ ...f, grass_type: value }));
  }

  function handleWeatherFreqChange(value: string) {
    setForm((f) => ({ ...f, weather_fetch_frequency: value }));
  }

  function handleTimezoneChange(value: string) {
    setForm((f) => ({ ...f, timezone: value }));
  }

  function handleWeatherEnabledChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, weather_enabled: e.target.checked }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await fetcher("/api/v1/lawns/", {
        method: "POST",
        data: {
          name: form.name,
          area: Number(form.area),
          grass_type: form.grass_type,
          notes: form.notes,
          weather_fetch_frequency: form.weather_fetch_frequency,
          timezone: form.timezone,
          weather_enabled: form.weather_enabled,
          latitude: parseFloat(form.latitude) || null,
          longitude: parseFloat(form.longitude) || null,
        },
      });
      setOpen(false);
      setForm({
        name: "",
        area: "",
        grass_type: "cold_season",
        notes: "",
        weather_fetch_frequency: "24h",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        weather_enabled: true,
        latitude: "",
        longitude: "",
      });
      queryClient.invalidateQueries({ queryKey: ["lawns"] });
    } catch (err: any) {
      setFormError(err.message || "Failed to add lawn");
    } finally {
      setSubmitting(false);
    }
  }

  function openEditModal(lawn: Lawn) {
    setEditLawn(lawn);
    setEditForm({
      name: lawn.name,
      area: String(lawn.area),
      grass_type: lawn.grass_type,
      notes: lawn.notes || "",
      weather_fetch_frequency: lawn.weather_fetch_frequency,
      timezone: lawn.timezone,
      weather_enabled: lawn.weather_enabled,
      latitude: lawn.latitude ? String(lawn.latitude) : "",
      longitude: lawn.longitude ? String(lawn.longitude) : "",
    });
    setEditOpen(true);
  }

  function handleEditInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setEditForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleEditGrassTypeChange(value: string) {
    setEditForm((f) => ({ ...f, grass_type: value }));
  }

  function handleEditWeatherFreqChange(value: string) {
    setEditForm((f) => ({ ...f, weather_fetch_frequency: value }));
  }

  function handleEditTimezoneChange(value: string) {
    setEditForm((f) => ({ ...f, timezone: value }));
  }

  function handleEditWeatherEnabledChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    setEditForm((f) => ({ ...f, weather_enabled: e.target.checked }));
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editLawn) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      await fetcher(`/api/v1/lawns/${editLawn.id}`, {
        method: "PUT",
        data: {
          name: editForm.name,
          area: Number(editForm.area),
          grass_type: editForm.grass_type,
          notes: editForm.notes,
          weather_fetch_frequency: editForm.weather_fetch_frequency,
          timezone: editForm.timezone,
          weather_enabled: editForm.weather_enabled,
          latitude: parseFloat(editForm.latitude) || null,
          longitude: parseFloat(editForm.longitude) || null,
        },
      });
      setEditOpen(false);
      setEditLawn(null);
      queryClient.invalidateQueries({ queryKey: ["lawns"] });
    } catch (err: any) {
      setEditError(err.message || "Failed to update lawn");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDeleteLawn() {
    if (!deleteLawn) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await fetcher(`/api/v1/lawns/${deleteLawn.id}`, { method: "DELETE" });
      await queryClient.resetQueries({ queryKey: ["lawns"] });
      setDeleteLawn(null);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete lawn");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="p-4 min-h-screen bg-muted/50 w-full">
      <Card className="min-h-[500px] w-full shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle className="text-2xl font-bold">Lawns</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm">
                + Add Lawn
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Lawn</DialogTitle>
                <DialogDescription>
                  Fill out the form to add a new lawn.
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
                    htmlFor="area"
                  >
                    Area (sq ft)
                  </label>
                  <Input
                    id="area"
                    name="area"
                    type="number"
                    min={0}
                    value={form.area}
                    onChange={handleInputChange}
                    required
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    htmlFor="grass_type"
                  >
                    Grass Type
                  </label>
                  <Select
                    value={form.grass_type}
                    onValueChange={handleGrassTypeChange}
                    disabled={submitting}
                  >
                    <SelectTrigger id="grass_type" name="grass_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GRASS_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    htmlFor="weather_fetch_frequency"
                  >
                    Weather Fetch Frequency
                  </label>
                  <Select
                    value={form.weather_fetch_frequency}
                    onValueChange={handleWeatherFreqChange}
                    disabled={submitting}
                  >
                    <SelectTrigger
                      id="weather_fetch_frequency"
                      name="weather_fetch_frequency"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEATHER_FREQ_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    htmlFor="timezone"
                  >
                    Timezone
                  </label>
                  <Select
                    value={form.timezone}
                    onValueChange={handleTimezoneChange}
                    disabled={submitting}
                  >
                    <SelectTrigger id="timezone" name="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="weather_enabled"
                    name="weather_enabled"
                    type="checkbox"
                    checked={form.weather_enabled}
                    onChange={handleWeatherEnabledChange}
                    disabled={submitting}
                    className="h-4 w-4 rounded border-gray-300 focus:ring-primary"
                  />
                  <label
                    htmlFor="weather_enabled"
                    className="text-sm font-medium"
                  >
                    Enable Weather Data
                  </label>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    htmlFor="notes"
                  >
                    Notes
                  </label>
                  <Input
                    id="notes"
                    name="notes"
                    value={form.notes}
                    onChange={handleInputChange}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    htmlFor="latitude"
                  >
                    Latitude
                  </label>
                  <Input
                    id="latitude"
                    name="latitude"
                    type="number"
                    value={form.latitude}
                    onChange={handleInputChange}
                    placeholder="e.g. 40.7128"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    htmlFor="longitude"
                  >
                    Longitude
                  </label>
                  <Input
                    id="longitude"
                    name="longitude"
                    type="number"
                    value={form.longitude}
                    onChange={handleInputChange}
                    placeholder="e.g. -74.0060"
                    disabled={submitting}
                  />
                </div>
                {formError && (
                  <div className="text-red-500 text-sm">{formError}</div>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Adding..." : "Add Lawn"}
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
        <CardContent
          className={
            !lawns || lawns.length === 0
              ? "min-h-[400px] flex flex-col items-center justify-center"
              : ""
          }
        >
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading lawns...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-500">
              Error loading lawns: {(error as Error).message}
            </div>
          ) : !lawns || lawns.length === 0 ? (
            <div className="flex flex-col items-center">
              <span className="text-4xl mb-2">🌱</span>
              <span className="text-muted-foreground text-lg">
                No lawns found.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 rounded-lg overflow-hidden bg-background">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-4 py-2 text-left font-semibold">Name</th>
                    <th className="px-4 py-2 text-left font-semibold">Area</th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Grass Type
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Weather Freq
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Weather Enabled
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">Edit</th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Delete
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lawns.map((lawn: Lawn, idx: number) => (
                    <tr
                      key={lawn.id}
                      className={
                        idx % 2 === 0
                          ? "bg-white hover:bg-muted/60 transition"
                          : "bg-muted/30 hover:bg-muted/60 transition"
                      }
                    >
                      <td className="px-4 py-2 border-b whitespace-nowrap">
                        {lawn.name}
                      </td>
                      <td className="px-4 py-2 border-b whitespace-nowrap">
                        {lawn.area}
                      </td>
                      <td className="px-4 py-2 border-b whitespace-nowrap capitalize">
                        {lawn.grass_type.replace("_", " ")}
                      </td>
                      <td className="px-4 py-2 border-b whitespace-nowrap">
                        {(() => {
                          switch (lawn.weather_fetch_frequency) {
                            case "4h":
                              return "Every 4 hours";
                            case "8h":
                              return "Every 8 hours";
                            case "12h":
                              return "Every 12 hours";
                            case "24h":
                              return "Every 24 hours (Daily)";
                            default:
                              return lawn.weather_fetch_frequency;
                          }
                        })()}
                      </td>
                      <td className="px-4 py-2 border-b whitespace-nowrap text-center">
                        {lawn.weather_enabled ? "✅" : "❌"}
                      </td>
                      <td className="px-4 py-2 border-b text-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditModal(lawn)}
                        >
                          <PencilIcon className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-4 py-2 border-b text-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteLawn(lawn)}
                        >
                          <Trash2Icon className="w-4 h-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Edit Lawn Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lawn</DialogTitle>
            <DialogDescription>
              Update the details for this lawn.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="edit_name"
              >
                Name
              </label>
              <Input
                id="edit_name"
                name="name"
                value={editForm.name}
                onChange={handleEditInputChange}
                required
                disabled={editSubmitting}
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="edit_area"
              >
                Area (sq ft)
              </label>
              <Input
                id="edit_area"
                name="area"
                type="number"
                min={0}
                value={editForm.area}
                onChange={handleEditInputChange}
                required
                disabled={editSubmitting}
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="edit_grass_type"
              >
                Grass Type
              </label>
              <Select
                value={editForm.grass_type}
                onValueChange={handleEditGrassTypeChange}
                disabled={editSubmitting}
              >
                <SelectTrigger id="edit_grass_type" name="grass_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRASS_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="edit_weather_fetch_frequency"
              >
                Weather Fetch Frequency
              </label>
              <Select
                value={editForm.weather_fetch_frequency}
                onValueChange={handleEditWeatherFreqChange}
                disabled={editSubmitting}
              >
                <SelectTrigger
                  id="edit_weather_fetch_frequency"
                  name="weather_fetch_frequency"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEATHER_FREQ_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="edit_timezone"
              >
                Timezone
              </label>
              <Select
                value={editForm.timezone}
                onValueChange={handleEditTimezoneChange}
                disabled={editSubmitting}
              >
                <SelectTrigger id="edit_timezone" name="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="edit_weather_enabled"
                name="weather_enabled"
                type="checkbox"
                checked={editForm.weather_enabled}
                onChange={handleEditWeatherEnabledChange}
                disabled={editSubmitting}
                className="h-4 w-4 rounded border-gray-300 focus:ring-primary"
              />
              <label
                htmlFor="edit_weather_enabled"
                className="text-sm font-medium"
              >
                Enable Weather Data
              </label>
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="edit_notes"
              >
                Notes
              </label>
              <Input
                id="edit_notes"
                name="notes"
                value={editForm.notes}
                onChange={handleEditInputChange}
                disabled={editSubmitting}
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="edit_latitude"
              >
                Latitude
              </label>
              <Input
                id="edit_latitude"
                name="latitude"
                type="number"
                value={editForm.latitude}
                onChange={handleEditInputChange}
                placeholder="e.g. 40.7128"
                disabled={editSubmitting}
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="edit_longitude"
              >
                Longitude
              </label>
              <Input
                id="edit_longitude"
                name="longitude"
                type="number"
                value={editForm.longitude}
                onChange={handleEditInputChange}
                placeholder="e.g. -74.0060"
                disabled={editSubmitting}
              />
            </div>
            {editError && (
              <div className="text-red-500 text-sm">{editError}</div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? "Saving..." : "Save Changes"}
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={editSubmitting}>
                  Cancel
                </Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Delete Lawn AlertDialog (controlled by deleteLawn) */}
      <AlertDialog
        open={!!deleteLawn}
        onOpenChange={(open) => {
          if (!open) setDeleteLawn(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lawn</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deleteLawn?.name}</span>? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="text-red-500 text-sm mb-2">{deleteError}</div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="ghost"
                disabled={deleteLoading}
                onClick={() => setDeleteLawn(null)}
              >
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteLoading}
                onClick={async () => {
                  await handleDeleteLawn();
                }}
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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
import { PencilIcon, Trash2Icon, ChevronUp, ChevronDown } from "lucide-react";
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

  // Fetch locations for dropdown
  const {
    data: locations,
    isLoading: locationsLoading,
    error: locationsError,
  } = useQuery({
    queryKey: ["locations"],
    queryFn: () => fetcher("/api/v1/locations/"),
    staleTime: 5 * 60 * 1000,
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
    location_id: "",
    // For new location
    new_location: false,
    new_location_name: "",
    new_location_latitude: "",
    new_location_longitude: "",
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
    location_id: "",
    new_location: false,
    new_location_name: "",
    new_location_latitude: "",
    new_location_longitude: "",
  });
  const [editSubmitting, setEditSubmitting] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  // Delete Lawn state
  const [deleteLawn, setDeleteLawn] = React.useState<Lawn | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Add search and sorting state
  const [search, setSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<string>("location");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

  // Derived filtered and sorted lawns
  const filteredLawns = React.useMemo(() => {
    if (!lawns) return [];
    let filtered = lawns;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      filtered = filtered.filter((lawn: Lawn) => {
        return (
          (lawn.location?.name || "").toLowerCase().includes(s) ||
          lawn.name.toLowerCase().includes(s) ||
          String(lawn.area).toLowerCase().includes(s) ||
          lawn.grass_type.toLowerCase().includes(s) ||
          lawn.weather_fetch_frequency.toLowerCase().includes(s) ||
          (lawn.notes || "").toLowerCase().includes(s) ||
          lawn.timezone.toLowerCase().includes(s)
        );
      });
    }
    const compare = (a: Lawn, b: Lawn) => {
      let valA, valB;
      switch (sortBy) {
        case "location":
          valA = a.location?.name || "";
          valB = b.location?.name || "";
          break;
        case "name":
          valA = a.name;
          valB = b.name;
          break;
        case "area":
          valA = a.area;
          valB = b.area;
          break;
        case "grass_type":
          valA = a.grass_type;
          valB = b.grass_type;
          break;
        case "weather_fetch_frequency":
          valA = a.weather_fetch_frequency;
          valB = b.weather_fetch_frequency;
          break;
        case "weather_enabled":
          valA = a.weather_enabled;
          valB = b.weather_enabled;
          break;
        default:
          valA = a[sortBy as keyof Lawn];
          valB = b[sortBy as keyof Lawn];
      }
      if (valA == null && valB == null) return 0;
      if (valA == null) return sortDir === "asc" ? -1 : 1;
      if (valB == null) return sortDir === "asc" ? 1 : -1;
      if (typeof valA === "number" && typeof valB === "number") {
        return sortDir === "asc" ? valA - valB : valB - valA;
      }
      return sortDir === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    };
    return [...filtered].sort(compare);
  }, [lawns, search, sortBy, sortDir]);

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

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

  function handleLocationChange(value: string) {
    if (value === "__new__") {
      setForm((f) => ({ ...f, new_location: true, location_id: "" }));
    } else {
      setForm((f) => ({ ...f, new_location: false, location_id: value }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      let locationId = form.location_id;
      if (form.new_location) {
        // Create new location first
        const loc = await fetcher("/api/v1/locations/", {
          method: "POST",
          data: {
            name: form.new_location_name,
            latitude: parseFloat(form.new_location_latitude),
            longitude: parseFloat(form.new_location_longitude),
          },
        });
        locationId = loc.id;
      }
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
          location_id: Number(locationId),
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
        location_id: "",
        new_location: false,
        new_location_name: "",
        new_location_latitude: "",
        new_location_longitude: "",
      });
      queryClient.invalidateQueries({ queryKey: ["lawns"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
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
      location_id:
        lawn.location && lawn.location.id ? String(lawn.location.id) : "",
      new_location: false,
      new_location_name: "",
      new_location_latitude: "",
      new_location_longitude: "",
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

  function handleEditLocationChange(value: string) {
    if (value === "__new__") {
      setEditForm((f) => ({ ...f, new_location: true, location_id: "" }));
    } else {
      setEditForm((f) => ({ ...f, new_location: false, location_id: value }));
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editLawn) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      let locationId = editForm.location_id;
      if (editForm.new_location) {
        // Create new location first
        const loc = await fetcher("/api/v1/locations/", {
          method: "POST",
          data: {
            name: editForm.new_location_name,
            latitude: parseFloat(editForm.new_location_latitude),
            longitude: parseFloat(editForm.new_location_longitude),
          },
        });
        locationId = loc.id;
      }
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
          location_id: Number(locationId),
        },
      });
      setEditOpen(false);
      setEditLawn(null);
      setEditForm({
        name: "",
        area: "",
        grass_type: "cold_season",
        notes: "",
        weather_fetch_frequency: "24h",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        weather_enabled: true,
        location_id: "",
        new_location: false,
        new_location_name: "",
        new_location_latitude: "",
        new_location_longitude: "",
      });
      queryClient.invalidateQueries({ queryKey: ["lawns"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
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
      await queryClient.resetQueries({ queryKey: ["locations"] });
      setDeleteLawn(null);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete lawn");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="p-4 min-h-screen bg-background w-full">
      <Card className="min-h-[500px] w-full shadow-lg bg-white dark:bg-gray-900 text-black dark:text-white">
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
                  <label className="block font-medium mb-1">Location</label>
                  <Select
                    value={form.new_location ? "__new__" : form.location_id}
                    onValueChange={handleLocationChange}
                    disabled={locationsLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          locationsLoading ? "Loading..." : "Select a location"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {locations &&
                        locations.map((loc: any) => (
                          <SelectItem key={loc.id} value={String(loc.id)}>
                            {loc.name} ({loc.latitude}, {loc.longitude})
                          </SelectItem>
                        ))}
                      <SelectItem value="__new__">
                        + Add new location
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.new_location && (
                  <div className="space-y-2">
                    <Input
                      name="new_location_name"
                      placeholder="Location Name"
                      value={form.new_location_name}
                      onChange={handleInputChange}
                      required
                    />
                    <Input
                      name="new_location_latitude"
                      placeholder="Latitude (e.g. 40.7128)"
                      value={form.new_location_latitude}
                      onChange={handleInputChange}
                      required
                    />
                    <Input
                      name="new_location_longitude"
                      placeholder="Longitude (e.g. -74.0060)"
                      value={form.new_location_longitude}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                )}
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
        {/* Search input */}
        <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-start md:items-center px-4 pb-2">
          <Input
            placeholder="Search lawns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64"
          />
        </div>
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
              <table className="min-w-full border-separate border-spacing-0 rounded-lg overflow-hidden bg-background dark:bg-gray-900 text-black dark:text-white">
                <thead>
                  <tr className="bg-muted">
                    <th
                      className="px-4 py-2 text-left font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("location")}
                    >
                      Location{" "}
                      {sortBy === "location" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-4 py-2 text-left font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("name")}
                    >
                      Name{" "}
                      {sortBy === "name" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-4 py-2 text-left font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("area")}
                    >
                      Area{" "}
                      {sortBy === "area" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-4 py-2 text-left font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("grass_type")}
                    >
                      Grass Type{" "}
                      {sortBy === "grass_type" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-4 py-2 text-left font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("weather_fetch_frequency")}
                    >
                      Weather Freq{" "}
                      {sortBy === "weather_fetch_frequency" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-4 py-2 text-left font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("weather_enabled")}
                    >
                      Weather Enabled{" "}
                      {sortBy === "weather_enabled" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">Edit</th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Delete
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLawns.map((lawn: Lawn, idx: number) => (
                    <tr
                      key={lawn.id}
                      className={
                        idx % 2 === 0
                          ? "bg-white dark:bg-gray-800 hover:bg-muted/60 dark:hover:bg-gray-700 transition"
                          : "bg-muted/30 dark:bg-gray-900 hover:bg-muted/60 dark:hover:bg-gray-800 transition"
                      }
                    >
                      <td className="px-4 py-2 border-b whitespace-nowrap">
                        {lawn.location?.name || ""}
                      </td>
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
              <label className="block font-medium mb-1">Location</label>
              <Select
                value={editForm.new_location ? "__new__" : editForm.location_id}
                onValueChange={handleEditLocationChange}
                disabled={locationsLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      locationsLoading ? "Loading..." : "Select a location"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {locations &&
                    locations.map((loc: any) => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {loc.name} ({loc.latitude}, {loc.longitude})
                      </SelectItem>
                    ))}
                  <SelectItem value="__new__">+ Add new location</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editForm.new_location && (
              <div className="space-y-2">
                <Input
                  name="new_location_name"
                  placeholder="Location Name"
                  value={editForm.new_location_name}
                  onChange={handleEditInputChange}
                  required
                />
                <Input
                  name="new_location_latitude"
                  placeholder="Latitude (e.g. 40.7128)"
                  value={editForm.new_location_latitude}
                  onChange={handleEditInputChange}
                  required
                />
                <Input
                  name="new_location_longitude"
                  placeholder="Longitude (e.g. -74.0060)"
                  value={editForm.new_location_longitude}
                  onChange={handleEditInputChange}
                  required
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
            </div>
            {editError && (
              <div className="text-red-500 text-sm mt-2">{editError}</div>
            )}
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

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "../lib/fetcher";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as React from "react";
import type { Lawn } from "../types/lawn";
import { LawnsTable } from "@/components/lawns/LawnsTable";
import { LawnFormDialog } from "@/components/lawns/LawnFormDialog";
import { LawnDeleteDialog } from "@/components/lawns/LawnDeleteDialog";

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
  const { data: locations } = useQuery({
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
    timezone: "America/New_York",
    weather_enabled: true,
    location_id: "",
    latitude: "",
    longitude: "",
    // For new location
    new_location: false,
    new_location_name: "",
    new_location_latitude: "",
    new_location_longitude: "",
  });
  const [submitting, setSubmitting] = React.useState(false);

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
        timezone: "America/New_York",
        weather_enabled: true,
        location_id: "",
        latitude: "",
        longitude: "",
        new_location: false,
        new_location_name: "",
        new_location_latitude: "",
        new_location_longitude: "",
      });
      queryClient.invalidateQueries({ queryKey: ["lawns"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
    } catch (err: any) {
      setEditError(err.message || "Failed to add lawn");
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
          <Button variant="default" size="sm" onClick={() => setOpen(true)}>
            + Add Lawn
          </Button>
        </CardHeader>
        <LawnFormDialog
          open={open}
          onOpenChange={setOpen}
          mode="add"
          form={form}
          locations={locations || []}
          submitting={submitting}
          onInputChange={handleInputChange}
          onGrassTypeChange={handleGrassTypeChange}
          onWeatherFreqChange={handleWeatherFreqChange}
          onTimezoneChange={handleTimezoneChange}
          onWeatherEnabledChange={handleWeatherEnabledChange}
          onLocationChange={handleLocationChange}
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
        />
        {/* Search input */}
        <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-start md:items-center px-4 pb-2">
          <Input
            placeholder="Search lawns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64"
          />
        </div>
        <CardContent className="w-full">
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
            <LawnsTable
              lawns={filteredLawns}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              onEdit={openEditModal}
              onDelete={setDeleteLawn}
            />
          )}
        </CardContent>
      </Card>
      {/* Edit Lawn Dialog */}
      <LawnFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        form={editForm}
        locations={locations || []}
        submitting={editSubmitting}
        error={editError}
        onInputChange={handleEditInputChange}
        onGrassTypeChange={handleEditGrassTypeChange}
        onWeatherFreqChange={handleEditWeatherFreqChange}
        onTimezoneChange={handleEditTimezoneChange}
        onWeatherEnabledChange={handleEditWeatherEnabledChange}
        onLocationChange={handleEditLocationChange}
        onSubmit={handleEditSubmit}
        onCancel={() => setEditOpen(false)}
      />
      {/* Delete Lawn AlertDialog (controlled by deleteLawn) */}
      <LawnDeleteDialog
        open={!!deleteLawn}
        error={deleteError}
        loading={deleteLoading}
        onCancel={() => setDeleteLawn(null)}
        onDelete={handleDeleteLawn}
      />
    </div>
  );
}

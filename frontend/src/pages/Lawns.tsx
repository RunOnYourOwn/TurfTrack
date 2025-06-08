import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/api/fetcher";
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

export interface Lawn {
  id: number;
  name: string;
  area: number;
  grass_type: "cold_season" | "warm_season";
  location: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

const GRASS_TYPE_OPTIONS = [
  { value: "cold_season", label: "Cold Season" },
  { value: "warm_season", label: "Warm Season" },
];

export default function Lawns() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<Lawn[]>({
    queryKey: ["lawns"],
    queryFn: () => fetcher<Lawn[]>("/api/v1/lawns"),
  });

  // Add Lawn modal state
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    area: "",
    grass_type: "cold_season",
    location: "",
    notes: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleGrassTypeChange(value: string) {
    setForm((f) => ({ ...f, grass_type: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetcher<Lawn>("/api/v1/lawns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          area: Number(form.area),
          grass_type: form.grass_type,
          location: form.location,
          notes: form.notes,
        }),
      });
      setOpen(false);
      setForm({
        name: "",
        area: "",
        grass_type: "cold_season",
        location: "",
        notes: "",
      });
      queryClient.invalidateQueries({ queryKey: ["lawns"] });
    } catch (err: any) {
      setFormError(err.message || "Failed to add lawn");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 min-h-screen bg-muted/50 flex flex-col items-center">
      <Card className="w-full max-w-5xl shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle className="text-2xl font-bold">Lawns</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm" className="ml-auto">
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
                    htmlFor="location"
                  >
                    Location
                  </label>
                  <Input
                    id="location"
                    name="location"
                    value={form.location}
                    onChange={handleInputChange}
                    required
                    disabled={submitting}
                  />
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
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading lawns...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-500">
              Error loading lawns: {(error as Error).message}
            </div>
          ) : !data || data.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No lawns found.
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
                      Location
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((lawn, idx) => (
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
                        {lawn.location}
                      </td>
                      <td className="px-4 py-2 border-b whitespace-nowrap">
                        {lawn.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

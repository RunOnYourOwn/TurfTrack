import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetcher } from "@/lib/fetcher";
import { MowerRead, MowerType, MowerFormData } from "@/types/mower";
import { Location } from "@/types/location";

interface MowerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editMower?: MowerRead | null;
}

export default function MowerFormDialog({
  open,
  onOpenChange,
  onSuccess,
  editMower = null,
}: MowerFormDialogProps) {
  const [form, setForm] = useState<MowerFormData>({
    name: "",
    brand: "",
    model: "",
    year: "",
    mower_type: "rotary" as MowerType,
    engine_hours: "",
    default_mowing_time_minutes: "",
    notes: "",
    location_id: "",
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch locations for dropdown
  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => fetcher<Location[]>("/api/v1/locations/"),
    staleTime: 5 * 60 * 1000,
  });

  // Reset form when dialog opens/closes or editMower changes
  useEffect(() => {
    if (open) {
      if (editMower) {
        setForm({
          name: editMower.name,
          brand: editMower.brand || "",
          model: editMower.model || "",
          year: editMower.year?.toString() || "",
          mower_type: editMower.mower_type,
          engine_hours: editMower.engine_hours.toString(),
          default_mowing_time_minutes:
            editMower.default_mowing_time_minutes?.toString() || "",
          notes: editMower.notes || "",
          location_id: editMower.location_id.toString(),
          is_active: editMower.is_active,
        });
      } else {
        setForm({
          name: "",
          brand: "",
          model: "",
          year: "",
          mower_type: "rotary" as MowerType,
          engine_hours: "0",
          default_mowing_time_minutes: "60",
          notes: "",
          location_id: locations?.[0]?.id?.toString() || "",
          is_active: true,
        });
      }
      setError(null);
    }
  }, [open, editMower, locations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim() || undefined,
        model: form.model.trim() || undefined,
        year: form.year ? parseInt(form.year) : undefined,
        mower_type: form.mower_type,
        engine_hours: parseFloat(form.engine_hours) || 0,
        default_mowing_time_minutes: form.default_mowing_time_minutes
          ? parseInt(form.default_mowing_time_minutes)
          : undefined,
        notes: form.notes.trim() || undefined,
        location_id: parseInt(form.location_id),
        is_active: form.is_active,
      };

      if (editMower) {
        await fetcher(`/api/v1/mowers/${editMower.id}`, {
          method: "PUT",
          data: payload,
        });
      } else {
        await fetcher("/api/v1/mowers/", {
          method: "POST",
          data: payload,
        });
      }

      onSuccess();
    } catch (err: any) {
      setError(
        err.response?.data?.detail || err.message || "An error occurred"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editMower ? "Edit Mower" : "Add Mower"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Name */}
          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name *
            </label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Front Yard Mower"
              required
            />
          </div>

          {/* Brand & Model */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label htmlFor="brand" className="text-sm font-medium">
                Brand
              </label>
              <Input
                id="brand"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="e.g., Honda"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="model" className="text-sm font-medium">
                Model
              </label>
              <Input
                id="model"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="e.g., HRX217"
              />
            </div>
          </div>

          {/* Year & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label htmlFor="year" className="text-sm font-medium">
                Year
              </label>
              <Input
                id="year"
                type="number"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                placeholder="2023"
                min="1900"
                max={new Date().getFullYear() + 1}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="mower_type" className="text-sm font-medium">
                Type *
              </label>
              <Select
                value={form.mower_type}
                onValueChange={(value: MowerType) =>
                  setForm({ ...form, mower_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rotary">Rotary</SelectItem>
                  <SelectItem value="reel">Reel</SelectItem>
                  <SelectItem value="zero_turn">Zero Turn</SelectItem>
                  <SelectItem value="riding">Riding</SelectItem>
                  <SelectItem value="robotic">Robotic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location */}
          <div className="grid gap-2">
            <label htmlFor="location_id" className="text-sm font-medium">
              Location *
            </label>
            <Select
              value={form.location_id}
              onValueChange={(value) =>
                setForm({ ...form, location_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations?.map((location) => (
                  <SelectItem key={location.id} value={location.id.toString()}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Engine Hours & Default Mowing Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label htmlFor="engine_hours" className="text-sm font-medium">
                Engine Hours
              </label>
              <Input
                id="engine_hours"
                type="number"
                value={form.engine_hours}
                onChange={(e) =>
                  setForm({ ...form, engine_hours: e.target.value })
                }
                placeholder="0"
                min="0"
                step="0.1"
              />
            </div>
            <div className="grid gap-2">
              <label
                htmlFor="default_mowing_time_minutes"
                className="text-sm font-medium"
              >
                Default Mowing Time (min)
              </label>
              <Input
                id="default_mowing_time_minutes"
                type="number"
                value={form.default_mowing_time_minutes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    default_mowing_time_minutes: e.target.value,
                  })
                }
                placeholder="60"
                min="1"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Notes
            </label>
            <Input
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Additional notes..."
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) =>
                setForm({ ...form, is_active: e.target.checked })
              }
              className="rounded"
            />
            <label htmlFor="is_active" className="text-sm font-medium">
              Active
            </label>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : editMower ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
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
import { MowerRead, MaintenanceType } from "@/types/mower";

interface MaintenanceScheduleFormData {
  maintenance_type: MaintenanceType;
  custom_name: string;
  interval_hours: string;
  interval_months: string;
  notes: string;
}

interface MaintenanceScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  mower: MowerRead | null;
}

export default function MaintenanceScheduleDialog({
  open,
  onOpenChange,
  onSuccess,
  mower,
}: MaintenanceScheduleDialogProps) {
  const [form, setForm] = useState<MaintenanceScheduleFormData>({
    maintenance_type: "oil_change" as MaintenanceType,
    custom_name: "",
    interval_hours: "50",
    interval_months: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setForm({
        maintenance_type: "oil_change" as MaintenanceType,
        custom_name: "",
        interval_hours: "50",
        interval_months: "",
        notes: "",
      });
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mower) return;

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        maintenance_type: form.maintenance_type,
        custom_name: form.custom_name.trim() || undefined,
        interval_hours: parseInt(form.interval_hours),
        interval_months: form.interval_months
          ? parseInt(form.interval_months)
          : undefined,
        notes: form.notes.trim() || undefined,
        parts: [], // TODO: Add parts management
      };

      await fetcher(`/api/v1/mowers/${mower.id}/maintenance-schedules`, {
        method: "POST",
        data: payload,
      });

      onSuccess();
    } catch (err: any) {
      console.error("Maintenance schedule creation error:", err);
      let errorMessage = "An error occurred";

      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          // Handle validation errors array
          errorMessage = err.response.data.detail
            .map((e: any) => `${e.loc?.join(".")}: ${e.msg}`)
            .join(", ");
        } else if (typeof err.response.data.detail === "string") {
          errorMessage = err.response.data.detail;
        } else {
          errorMessage = JSON.stringify(err.response.data.detail);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!mower) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Schedule Maintenance - {mower.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Maintenance Type */}
          <div className="grid gap-2">
            <label htmlFor="maintenance_type" className="text-sm font-medium">
              Maintenance Type *
            </label>
            <Select
              value={form.maintenance_type}
              onValueChange={(value: MaintenanceType) =>
                setForm({ ...form, maintenance_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="oil_change">Oil Change</SelectItem>
                <SelectItem value="air_filter">Air Filter</SelectItem>
                <SelectItem value="spark_plug">Spark Plug</SelectItem>
                <SelectItem value="blade_sharpening">
                  Blade Sharpening
                </SelectItem>
                <SelectItem value="belt_replacement">
                  Belt Replacement
                </SelectItem>
                <SelectItem value="fuel_filter">Fuel Filter</SelectItem>
                <SelectItem value="general_service">General Service</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Name (for general service) */}
          {form.maintenance_type === "general_service" && (
            <div className="grid gap-2">
              <label htmlFor="custom_name" className="text-sm font-medium">
                Service Name *
              </label>
              <Input
                id="custom_name"
                value={form.custom_name}
                onChange={(e) =>
                  setForm({ ...form, custom_name: e.target.value })
                }
                placeholder="e.g., Transmission Service"
                required={form.maintenance_type === "general_service"}
              />
            </div>
          )}

          {/* Intervals */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label htmlFor="interval_hours" className="text-sm font-medium">
                Interval (Hours) *
              </label>
              <Input
                id="interval_hours"
                type="number"
                value={form.interval_hours}
                onChange={(e) =>
                  setForm({ ...form, interval_hours: e.target.value })
                }
                placeholder="50"
                min="1"
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="interval_months" className="text-sm font-medium">
                Interval (Months)
              </label>
              <Input
                id="interval_months"
                type="number"
                value={form.interval_months}
                onChange={(e) =>
                  setForm({ ...form, interval_months: e.target.value })
                }
                placeholder="6"
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
              placeholder="Optional notes about this maintenance schedule..."
            />
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
              {submitting ? "Creating..." : "Create Schedule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
import { MaintenanceType } from "@/types/mower";

interface MaintenanceScheduleFormData {
  maintenance_type: MaintenanceType;
  custom_name: string;
  interval_hours: string;
  interval_months: string;
  notes: string;
}

interface MaintenanceScheduleEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maintenanceSchedule: any;
  mowerId: string;
  onSuccess: () => void;
}

export default function MaintenanceScheduleEditDialog({
  open,
  onOpenChange,
  maintenanceSchedule,
  mowerId,
  onSuccess,
}: MaintenanceScheduleEditDialogProps) {
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
    if (open && maintenanceSchedule) {
      setForm({
        maintenance_type: maintenanceSchedule.maintenance_type || "oil_change",
        custom_name: maintenanceSchedule.custom_name || "",
        interval_hours: maintenanceSchedule.interval_hours?.toString() || "50",
        interval_months: maintenanceSchedule.interval_months?.toString() || "",
        notes: maintenanceSchedule.notes || "",
      });
      setError(null);
    }
  }, [open, maintenanceSchedule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenanceSchedule) return;

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

      await fetcher(
        `/api/v1/mowers/${mowerId}/maintenance-schedules/${maintenanceSchedule.id}`,
        {
          method: "PUT",
          data: payload,
        }
      );

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Maintenance schedule update error:", err);
      let errorMessage = "An error occurred";

      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          // Handle validation errors array
          errorMessage = err.response.data.detail
            .map((e: any) => `${e.loc?.join(".")}: ${e.msg}`)
            .join(", ");
        } else if (typeof err.response.data.detail === "string") {
          errorMessage = err.response.data.detail;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const getMaintenanceTypeDisplayName = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Maintenance Schedule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Maintenance Type</label>
            <Select
              value={form.maintenance_type}
              onValueChange={(value) =>
                setForm({ ...form, maintenance_type: value as MaintenanceType })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(MaintenanceType).map((type) => (
                  <SelectItem key={type} value={type}>
                    {getMaintenanceTypeDisplayName(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.maintenance_type === "general_service" && (
            <div>
              <label className="text-sm font-medium">Custom Service Name</label>
              <Input
                placeholder="e.g., Spring Tune-up, Winter Service"
                value={form.custom_name}
                onChange={(e) =>
                  setForm({ ...form, custom_name: e.target.value })
                }
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Interval (Hours)</label>
            <Input
              type="number"
              min="1"
              value={form.interval_hours}
              onChange={(e) =>
                setForm({ ...form, interval_hours: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Interval (Months)</label>
            <Input
              type="number"
              min="1"
              value={form.interval_months}
              onChange={(e) =>
                setForm({ ...form, interval_months: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Notes</label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Optional notes about this maintenance schedule"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {error && <div className="text-red-500 text-sm">{error}</div>}

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Updating..." : "Update"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
import { useQuery } from "@tanstack/react-query";

interface MaintenanceLogFormData {
  maintenance_type: MaintenanceType;
  custom_name: string;
  maintenance_date: string;
  hours_at_maintenance: string;
  total_cost: string;
  labor_cost: string;
  performed_by: string;
  notes: string;
  maintenance_schedule_id: string | null;
}

interface MaintenanceLogEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maintenanceLog: any;
  mowerId: string;
  mowerTotalHours: number;
  onSuccess: () => void;
}

export default function MaintenanceLogEditDialog({
  open,
  onOpenChange,
  maintenanceLog,
  mowerId,
  mowerTotalHours,
  onSuccess,
}: MaintenanceLogEditDialogProps) {
  const [form, setForm] = useState<MaintenanceLogFormData>({
    maintenance_type: "oil_change" as MaintenanceType,
    custom_name: "",
    maintenance_date: "",
    hours_at_maintenance: "",
    total_cost: "",
    labor_cost: "",
    performed_by: "",
    notes: "",
    maintenance_schedule_id: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch maintenance schedules for linking
  const { data: maintenanceSchedules } = useQuery({
    queryKey: ["maintenance-schedules", mowerId],
    queryFn: () => fetcher(`/api/v1/mowers/${mowerId}/maintenance-schedules`),
    enabled: open && !!mowerId,
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && maintenanceLog) {
      setForm({
        maintenance_type: maintenanceLog.maintenance_type || "oil_change",
        custom_name: maintenanceLog.custom_name || "",
        maintenance_date: maintenanceLog.maintenance_date
          ? new Date(maintenanceLog.maintenance_date)
              .toISOString()
              .split("T")[0]
          : "",
        hours_at_maintenance:
          maintenanceLog.hours_at_maintenance?.toString() || "",
        total_cost: maintenanceLog.total_cost?.toString() || "",
        labor_cost: maintenanceLog.labor_cost?.toString() || "",
        performed_by: maintenanceLog.performed_by || "",
        notes: maintenanceLog.notes || "",
        maintenance_schedule_id:
          maintenanceLog.maintenance_schedule_id?.toString() || null,
      });
      setError(null);
    }
  }, [open, maintenanceLog]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenanceLog) return;

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        maintenance_type: form.maintenance_type,
        custom_name: form.custom_name.trim() || undefined,
        maintenance_date: form.maintenance_date,
        hours_at_maintenance: parseInt(form.hours_at_maintenance),
        total_cost: form.total_cost ? parseFloat(form.total_cost) : undefined,
        labor_cost: form.labor_cost ? parseFloat(form.labor_cost) : undefined,
        performed_by: form.performed_by.trim() || undefined,
        notes: form.notes.trim() || undefined,
        maintenance_schedule_id:
          form.maintenance_schedule_id === "none"
            ? null
            : parseInt(form.maintenance_schedule_id || "0"),
        parts_used: [], // TODO: Add parts management
      };

      await fetcher(
        `/api/v1/mowers/${mowerId}/maintenance-logs/${maintenanceLog.id}`,
        {
          method: "PUT",
          data: payload,
        }
      );

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Maintenance log update error:", err);
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

  const handleUseCurrentHours = () => {
    setForm({ ...form, hours_at_maintenance: mowerTotalHours.toString() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Maintenance Log</DialogTitle>
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
            <label className="text-sm font-medium">Maintenance Date</label>
            <Input
              type="date"
              value={form.maintenance_date}
              onChange={(e) =>
                setForm({ ...form, maintenance_date: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Hours at Maintenance</label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                value={form.hours_at_maintenance}
                onChange={(e) =>
                  setForm({ ...form, hours_at_maintenance: e.target.value })
                }
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleUseCurrentHours}
                className="whitespace-nowrap"
              >
                Use Current Hours
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Total Cost ($)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.total_cost}
              onChange={(e) => setForm({ ...form, total_cost: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Labor Cost ($)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.labor_cost}
              onChange={(e) => setForm({ ...form, labor_cost: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Performed By</label>
            <Input
              placeholder="e.g., John Doe, Professional Service"
              value={form.performed_by}
              onChange={(e) =>
                setForm({ ...form, performed_by: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Link to Schedule (Optional)
            </label>
            <Select
              value={form.maintenance_schedule_id || "none"}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  maintenance_schedule_id: value === "none" ? null : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No schedule link</SelectItem>
                {maintenanceSchedules?.map((schedule: any) => (
                  <SelectItem key={schedule.id} value={schedule.id.toString()}>
                    {schedule.custom_name ||
                      getMaintenanceTypeDisplayName(schedule.maintenance_type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Notes</label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Optional notes about this maintenance"
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

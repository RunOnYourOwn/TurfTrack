import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MaintenanceType, MaintenanceScheduleRead } from "@/types/mower";
import { fetcher } from "@/lib/fetcher";
import { useQueryClient, useQuery } from "@tanstack/react-query";

interface MaintenanceLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mowerId: number;
  mowerTotalHours?: number;
  onSuccess: () => void;
}

export default function MaintenanceLogDialog({
  open,
  onOpenChange,
  mowerId,
  mowerTotalHours,
  onSuccess,
}: MaintenanceLogDialogProps) {
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceType | "">(
    ""
  );
  const [customName, setCustomName] = useState("");
  const [maintenanceDate, setMaintenanceDate] = useState("");
  const [hoursAtMaintenance, setHoursAtMaintenance] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  // Fetch maintenance schedules for this mower
  const { data: maintenanceSchedules } = useQuery({
    queryKey: ["maintenance-schedules", mowerId],
    queryFn: () => fetcher(`/api/v1/mowers/${mowerId}/maintenance-schedules`),
    enabled: open,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const payload = {
        maintenance_type: maintenanceType,
        custom_name: customName || undefined,
        maintenance_date: maintenanceDate,
        hours_at_maintenance: parseInt(hoursAtMaintenance),
        total_cost: totalCost ? parseFloat(totalCost) : undefined,
        labor_cost: laborCost ? parseFloat(laborCost) : undefined,
        performed_by: performedBy || undefined,
        notes: notes || undefined,
        maintenance_schedule_id: selectedScheduleId || undefined,
        parts_used: [], // TODO: Add parts functionality later
      };

      await fetcher(`/api/v1/mowers/${mowerId}/maintenance-logs`, {
        method: "POST",
        data: payload,
      });

      onSuccess();
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["mowers"] });
      queryClient.invalidateQueries({
        queryKey: ["maintenance-schedules", mowerId],
      });
    } catch (err: any) {
      console.error("Maintenance log creation error:", err);
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

  const resetForm = () => {
    setMaintenanceType("");
    setCustomName("");
    setMaintenanceDate("");
    setHoursAtMaintenance("");
    setTotalCost("");
    setLaborCost("");
    setPerformedBy("");
    setNotes("");
    setSelectedScheduleId(null);
    setError("");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Maintenance</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="maintenance-type">Maintenance Type *</Label>
            <Select
              value={maintenanceType}
              onValueChange={(value) =>
                setMaintenanceType(value as MaintenanceType)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select maintenance type" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(MaintenanceType).map((type) => (
                  <SelectItem key={type} value={type}>
                    {type
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {maintenanceType === MaintenanceType.GENERAL_SERVICE && (
            <div className="space-y-2">
              <Label htmlFor="custom-name">Custom Name</Label>
              <Input
                id="custom-name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g., Spring tune-up"
              />
            </div>
          )}

          {/* Schedule Selection */}
          {maintenanceSchedules && maintenanceSchedules.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="schedule-select">
                Link to Schedule (Optional)
              </Label>
              <Select
                value={selectedScheduleId?.toString() || "none"}
                onValueChange={(value) =>
                  setSelectedScheduleId(
                    value === "none" ? null : parseInt(value)
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a maintenance schedule to link" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No schedule link</SelectItem>
                  {maintenanceSchedules.map(
                    (schedule: MaintenanceScheduleRead) => (
                      <SelectItem
                        key={schedule.id}
                        value={schedule.id.toString()}
                      >
                        {schedule.custom_name ||
                          schedule.maintenance_type
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        {schedule.is_due && " (Due)"}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="maintenance-date">Maintenance Date *</Label>
            <Input
              id="maintenance-date"
              type="date"
              value={maintenanceDate}
              onChange={(e) => setMaintenanceDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hours-at-maintenance">Hours at Maintenance *</Label>
            <div className="flex gap-2">
              <Input
                id="hours-at-maintenance"
                type="number"
                min="0"
                value={hoursAtMaintenance}
                onChange={(e) => setHoursAtMaintenance(e.target.value)}
                placeholder="Current engine hours"
                required
                className="flex-1"
              />
              {mowerTotalHours !== undefined && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setHoursAtMaintenance(mowerTotalHours.toString())
                  }
                  className="whitespace-nowrap"
                >
                  Use Current ({mowerTotalHours}h)
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="total-cost">Total Cost</Label>
              <Input
                id="total-cost"
                type="number"
                min="0"
                step="0.01"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="labor-cost">Labor Cost</Label>
              <Input
                id="labor-cost"
                type="number"
                min="0"
                step="0.01"
                value={laborCost}
                onChange={(e) => setLaborCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="performed-by">Performed By</Label>
            <Input
              id="performed-by"
              value={performedBy}
              onChange={(e) => setPerformedBy(e.target.value)}
              placeholder="Who performed the maintenance"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details about the maintenance"
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                !maintenanceType ||
                !maintenanceDate ||
                !hoursAtMaintenance
              }
            >
              {submitting ? "Logging..." : "Log Maintenance"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

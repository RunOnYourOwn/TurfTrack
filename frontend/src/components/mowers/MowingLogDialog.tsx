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
import { MowerRead } from "@/types/mower";
import { Lawn } from "@/types/lawn";

interface MowingLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  mower: MowerRead | null;
}

interface MowingLogFormData {
  lawn_id: string;
  mowing_date: string;
  duration_minutes: string;
  notes: string;
}

export default function MowingLogDialog({
  open,
  onOpenChange,
  onSuccess,
  mower,
}: MowingLogDialogProps) {
  const [form, setForm] = useState<MowingLogFormData>({
    lawn_id: "",
    mowing_date: new Date().toISOString().split("T")[0], // Today's date
    duration_minutes: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch lawns for dropdown
  const { data: lawns } = useQuery({
    queryKey: ["lawns"],
    queryFn: () => fetcher<Lawn[]>("/api/v1/lawns/"),
    staleTime: 5 * 60 * 1000,
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && mower) {
      setForm({
        lawn_id: "",
        mowing_date: new Date().toISOString().split("T")[0],
        duration_minutes: mower.default_mowing_time_minutes?.toString() || "60",
        notes: "",
      });
      setError(null);
    }
  }, [open, mower]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mower) return;

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        lawn_id: parseInt(form.lawn_id),
        mowing_date: form.mowing_date,
        duration_minutes: parseInt(form.duration_minutes),
        notes: form.notes.trim() || undefined,
      };

      await fetcher(`/api/v1/mowers/${mower.id}/mowing-logs`, {
        method: "POST",
        data: payload,
      });

      onSuccess();
    } catch (err: any) {
      console.error("Mowing log creation error:", err);
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
          <DialogTitle>Log Mowing Session - {mower.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Lawn Selection */}
          <div className="grid gap-2">
            <label htmlFor="lawn_id" className="text-sm font-medium">
              Lawn *
            </label>
            <Select
              value={form.lawn_id}
              onValueChange={(value) => setForm({ ...form, lawn_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select lawn" />
              </SelectTrigger>
              <SelectContent>
                {lawns?.map((lawn) => (
                  <SelectItem key={lawn.id} value={lawn.id.toString()}>
                    {lawn.name} ({lawn.area} sq ft)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date and Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label htmlFor="mowing_date" className="text-sm font-medium">
                Date *
              </label>
              <Input
                id="mowing_date"
                type="date"
                value={form.mowing_date}
                onChange={(e) =>
                  setForm({ ...form, mowing_date: e.target.value })
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="duration_minutes" className="text-sm font-medium">
                Duration (minutes) *
              </label>
              <Input
                id="duration_minutes"
                type="number"
                value={form.duration_minutes}
                onChange={(e) =>
                  setForm({ ...form, duration_minutes: e.target.value })
                }
                placeholder="60"
                min="1"
                required
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
              placeholder="Optional notes about this mowing session..."
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
              {submitting ? "Logging..." : "Log Mowing"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

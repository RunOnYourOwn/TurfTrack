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
import { useQuery } from "@tanstack/react-query";

interface MowingLogFormData {
  lawn_id: string;
  date: string;
  duration_minutes: string;
  notes: string;
}

interface MowingLogEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mowingLog: any;
  mowerId: string;
  onSuccess: () => void;
}

export default function MowingLogEditDialog({
  open,
  onOpenChange,
  mowingLog,
  mowerId,
  onSuccess,
}: MowingLogEditDialogProps) {
  const [form, setForm] = useState<MowingLogFormData>({
    lawn_id: "",
    date: "",
    duration_minutes: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch lawns for the dropdown
  const { data: lawns } = useQuery({
    queryKey: ["lawns"],
    queryFn: () => fetcher("/api/v1/lawns/"),
    staleTime: 5 * 60 * 1000,
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && mowingLog) {
      setForm({
        lawn_id: mowingLog.lawn_id?.toString() || "",
        date: mowingLog.date
          ? new Date(mowingLog.date).toISOString().split("T")[0]
          : "",
        duration_minutes: mowingLog.duration_minutes?.toString() || "",
        notes: mowingLog.notes || "",
      });
      setError(null);
    }
  }, [open, mowingLog]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mowingLog) return;

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        lawn_id: parseInt(form.lawn_id),
        mowing_date: form.date,
        duration_minutes: parseInt(form.duration_minutes),
        notes: form.notes.trim() || undefined,
      };

      await fetcher(`/api/v1/mowers/${mowerId}/mowing-logs/${mowingLog.id}`, {
        method: "PUT",
        data: payload,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Mowing log update error:", err);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Mowing Log</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Lawn</label>
            <Select
              value={form.lawn_id}
              onValueChange={(value) => setForm({ ...form, lawn_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a lawn" />
              </SelectTrigger>
              <SelectContent>
                {lawns?.map((lawn: any) => (
                  <SelectItem key={lawn.id} value={lawn.id.toString()}>
                    {lawn.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Duration (minutes)</label>
            <Input
              type="number"
              min="1"
              value={form.duration_minutes}
              onChange={(e) =>
                setForm({ ...form, duration_minutes: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Notes</label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Optional notes about this mowing session"
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

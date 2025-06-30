import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const GRASS_TYPE_OPTIONS = [
  { value: "cold_season", label: "Cold Season" },
  { value: "warm_season", label: "Warm Season" },
];
const WEATHER_FREQ_OPTIONS = [
  { value: "4h", label: "Every 4 hours" },
  { value: "8h", label: "Every 8 hours" },
  { value: "12h", label: "Every 12 hours" },
  { value: "24h", label: "Every 24 hours (Daily)" },
];
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

interface LawnFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  form: any;
  locations: any[];
  submitting: boolean;
  error?: string | null;
  onInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  onGrassTypeChange: (value: string) => void;
  onWeatherFreqChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
  onWeatherEnabledChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLocationChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export const LawnFormDialog: React.FC<LawnFormDialogProps> = ({
  open,
  onOpenChange,
  mode,
  form,
  locations,
  submitting,
  error,
  onInputChange,
  onGrassTypeChange,
  onWeatherFreqChange,
  onTimezoneChange,
  onWeatherEnabledChange,
  onLocationChange,
  onSubmit,
  onCancel,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{mode === "edit" ? "Edit Lawn" : "Add Lawn"}</DialogTitle>
        <DialogDescription>
          Fill out the form to {mode === "edit" ? "edit" : "add"} a lawn.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="name">
            Name
          </label>
          <Input
            id="name"
            name="name"
            value={form.name}
            onChange={onInputChange}
            required
            disabled={submitting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="area">
            Area (sq ft)
          </label>
          <Input
            id="area"
            name="area"
            type="number"
            min={0}
            value={form.area}
            onChange={onInputChange}
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
            onValueChange={onGrassTypeChange}
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
            onValueChange={onWeatherFreqChange}
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
          <label className="block text-sm font-medium mb-1" htmlFor="timezone">
            Timezone
          </label>
          <Select
            value={form.timezone}
            onValueChange={onTimezoneChange}
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
            onChange={onWeatherEnabledChange}
            disabled={submitting}
            className="h-4 w-4 rounded border-gray-300 focus:ring-primary"
          />
          <label htmlFor="weather_enabled" className="text-sm font-medium">
            Enable Weather Data
          </label>
        </div>
        <div>
          <label
            className="block text-sm font-medium mb-1"
            htmlFor="location_id"
          >
            Location
          </label>
          <Select
            value={form.location_id}
            onValueChange={onLocationChange}
            disabled={submitting}
          >
            <SelectTrigger id="location_id" name="location_id">
              <SelectValue placeholder="Select a location" />
            </SelectTrigger>
            <SelectContent>
              {locations && locations.length > 0 ? (
                <>
                  {locations.map((loc: any) => (
                    <SelectItem key={loc.id} value={String(loc.id)}>
                      {loc.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">+ Add New Location</SelectItem>
                </>
              ) : (
                <>
                  <div className="px-4 py-2 text-muted-foreground">
                    No locations found
                  </div>
                  <SelectItem value="__new__">+ Add New Location</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
        {form.new_location && (
          <>
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="new_location_name"
              >
                New Location Name
              </label>
              <Input
                id="new_location_name"
                name="new_location_name"
                value={form.new_location_name}
                onChange={onInputChange}
                disabled={submitting}
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="new_location_latitude"
              >
                Latitude
              </label>
              <Input
                id="new_location_latitude"
                name="new_location_latitude"
                value={form.new_location_latitude}
                onChange={onInputChange}
                disabled={submitting}
                placeholder="e.g. 40.7128"
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="new_location_longitude"
              >
                Longitude
              </label>
              <Input
                id="new_location_longitude"
                name="new_location_longitude"
                value={form.new_location_longitude}
                onChange={onInputChange}
                disabled={submitting}
                placeholder="e.g. -74.0060"
              />
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="notes">
            Notes
          </label>
          <Input
            id="notes"
            name="notes"
            value={form.notes}
            onChange={onInputChange}
            disabled={submitting}
          />
        </div>
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <DialogFooter>
          <Button type="submit" disabled={submitting}>
            {submitting
              ? mode === "edit"
                ? "Saving..."
                : "Adding..."
              : mode === "edit"
              ? "Save Changes"
              : "Add Lawn"}
          </Button>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={onCancel}
            >
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
);

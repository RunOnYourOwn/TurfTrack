import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";

interface GDDFormProps {
  form: {
    name: string;
    base_temp: string;
    unit: string;
    start_date: string;
    threshold: string;
    reset_on_threshold: boolean;
  };
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUnitChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  formError?: string | null;
  onCancel: () => void;
}

export const GDDForm: React.FC<GDDFormProps> = ({
  form,
  onChange,
  onUnitChange,
  onSubmit,
  submitting,
  formError,
  onCancel,
}) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <div>
      <label className="block text-sm font-medium mb-1" htmlFor="name">
        Name
      </label>
      <Input
        id="name"
        name="name"
        value={form.name}
        onChange={onChange}
        required
        disabled={submitting}
      />
    </div>
    <div>
      <label className="block text-sm font-medium mb-1" htmlFor="base_temp">
        Base Temp
      </label>
      <Input
        id="base_temp"
        name="base_temp"
        type="number"
        value={form.base_temp}
        onChange={onChange}
        required
        disabled={submitting}
      />
    </div>
    <div>
      <label className="block text-sm font-medium mb-1" htmlFor="unit">
        Unit
      </label>
      <Select
        value={form.unit}
        onValueChange={onUnitChange}
        disabled={submitting}
      >
        <SelectTrigger id="unit" name="unit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="C">Celsius (°C)</SelectItem>
          <SelectItem value="F">Fahrenheit (°F)</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div>
      <label className="block text-sm font-medium mb-1" htmlFor="start_date">
        Start Date
      </label>
      <Input
        id="start_date"
        name="start_date"
        type="date"
        value={form.start_date}
        onChange={onChange}
        required
        disabled={submitting}
      />
    </div>
    <div>
      <label className="block text-sm font-medium mb-1" htmlFor="threshold">
        Threshold
      </label>
      <Input
        id="threshold"
        name="threshold"
        type="number"
        value={form.threshold}
        onChange={onChange}
        required
        disabled={submitting}
      />
    </div>
    <div className="flex items-center gap-2">
      <input
        id="reset_on_threshold"
        name="reset_on_threshold"
        type="checkbox"
        checked={form.reset_on_threshold}
        onChange={onChange}
        disabled={submitting}
        className="h-4 w-4 rounded border-gray-300 focus:ring-primary"
      />
      <label htmlFor="reset_on_threshold" className="text-sm font-medium">
        Reset on Threshold
      </label>
    </div>
    {formError && <div className="text-red-500 text-sm">{formError}</div>}
    <DialogFooter>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Adding..." : "Add GDD Model"}
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
);

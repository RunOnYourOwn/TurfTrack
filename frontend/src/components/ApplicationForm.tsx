import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type ApplicationFormValues = {
  application_date: string;
  lawn_id?: number | "";
  product_id: number | "";
  amount_per_area: number | "";
  area_unit: number | "";
  unit: string;
  status: string;
  notes?: string;
  tied_gdd_model_id?: number | "";
  lawn_ids?: number[];
};

type ApplicationFormProps = {
  initialValues?: Partial<ApplicationFormValues>;
  mode: "add" | "edit";
  submitting: boolean;
  error?: string | null;
  onSubmit: (values: ApplicationFormValues) => void;
  onCancel: () => void;
  lawns: Array<{ id: number; name: string }>;
  products: Array<{ id: number; name: string }>;
  gddModels: Array<{ id: number; name: string; lawn_id: number }>;
};

const UNIT_OPTIONS = [
  { value: "lbs", label: "lbs" },
  { value: "oz", label: "oz" },
  { value: "gal", label: "gal" },
  { value: "ml", label: "ml" },
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
];

const STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "completed", label: "Completed" },
  { value: "skipped", label: "Skipped" },
];

export function ApplicationForm({
  initialValues = {},
  mode,
  submitting,
  error,
  onSubmit,
  onCancel,
  lawns,
  products,
  gddModels,
}: ApplicationFormProps) {
  const [form, setForm] = React.useState<ApplicationFormValues>({
    application_date: initialValues.application_date || "",
    lawn_id: initialValues.lawn_id ?? "",
    product_id: initialValues.product_id ?? "",
    amount_per_area: initialValues.amount_per_area ?? "",
    area_unit: initialValues.area_unit ?? 1000,
    unit: initialValues.unit || "lbs",
    status: initialValues.status || "planned",
    notes: initialValues.notes || "",
    tied_gdd_model_id: initialValues.tied_gdd_model_id ?? "",
    lawn_ids:
      initialValues.lawn_ids ??
      (initialValues.lawn_id ? [initialValues.lawn_id] : []),
  });

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    const { name } = e.target;
    if (name === "lawn_ids") {
      const { options } = e.target as HTMLSelectElement;
      const selected = Array.from(options)
        .filter((o) => o.selected)
        .map((o) => Number(o.value));
      setForm((f) => ({
        ...f,
        lawn_ids: selected,
        lawn_id: selected.length === 1 ? selected[0] : "",
      }));
    } else {
      const { value, type } = e.target as HTMLInputElement;
      if (type === "number") {
        setForm((f) => ({
          ...f,
          [name]: value === "" ? "" : Number(value),
        }));
      } else {
        setForm((f) => ({
          ...f,
          [name]: value,
        }));
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.lawn_ids && form.lawn_ids.length > 1) {
      const { lawn_id, ...rest } = form;
      onSubmit({ ...rest, lawn_ids: form.lawn_ids });
    } else if (form.lawn_ids && form.lawn_ids.length === 1) {
      const { lawn_ids, ...rest } = form;
      onSubmit({ ...rest, lawn_id: form.lawn_ids[0] });
    } else {
      onSubmit(form);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          className="block text-sm font-medium mb-1"
          htmlFor="application_date"
        >
          Application Date
        </label>
        <Input
          id="application_date"
          name="application_date"
          type="date"
          value={form.application_date}
          onChange={handleChange}
          required
          disabled={submitting}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="lawn_ids">
            Lawn(s)
          </label>
          <select
            id="lawn_ids"
            name="lawn_ids"
            multiple
            value={(form.lawn_ids || []).map(String)}
            onChange={handleChange}
            required={(form.lawn_ids || []).length === 0}
            disabled={submitting}
            className="w-full border rounded px-2 py-1 min-h-[60px]"
          >
            {lawns.map((lawn) => (
              <option key={lawn.id} value={String(lawn.id)}>
                {lawn.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="block text-sm font-medium mb-1"
            htmlFor="product_id"
          >
            Product
          </label>
          <select
            id="product_id"
            name="product_id"
            value={form.product_id}
            onChange={handleChange}
            required
            disabled={submitting}
            className="w-full border rounded px-2 py-1"
          >
            <option value="">Select product</option>
            {products
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label
            className="block text-sm font-medium mb-1"
            htmlFor="amount_per_area"
          >
            Amount per Area
          </label>
          <Input
            id="amount_per_area"
            name="amount_per_area"
            type="number"
            step="any"
            value={form.amount_per_area}
            onChange={handleChange}
            required
            disabled={submitting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="area_unit">
            Area Unit (sq ft)
          </label>
          <Input
            id="area_unit"
            name="area_unit"
            type="number"
            step="any"
            value={form.area_unit}
            onChange={handleChange}
            required
            disabled={submitting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="unit">
            Unit
          </label>
          <select
            id="unit"
            name="unit"
            value={form.unit}
            onChange={handleChange}
            required
            disabled={submitting}
            className="w-full border rounded px-2 py-1"
          >
            {UNIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={form.status}
            onChange={handleChange}
            required
            disabled={submitting}
            className="w-full border rounded px-2 py-1"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            disabled={submitting}
            className="w-full border rounded px-2 py-1 min-h-[60px]"
          />
        </div>
        <div className="col-span-2">
          <label
            className="block text-sm font-medium mb-1"
            htmlFor="tied_gdd_model_id"
          >
            GDD Model (optional)
          </label>
          <select
            id="tied_gdd_model_id"
            name="tied_gdd_model_id"
            value={form.tied_gdd_model_id}
            onChange={handleChange}
            disabled={submitting}
            className="w-full border rounded px-2 py-1"
          >
            <option value="">None</option>
            {gddModels.map((model) => {
              const lawn = lawns.find((l) => l.id === model.lawn_id);
              const label = lawn ? `${lawn.name} – ${model.name}` : model.name;
              return (
                <option key={model.id} value={model.id}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
      </div>
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting
            ? mode === "add"
              ? "Adding..."
              : "Saving..."
            : mode === "add"
            ? "Add Application"
            : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Select from "react-select";

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

const selectStyles = {
  control: (base: any) => ({
    ...base,
    minHeight: 36,
    borderRadius: 6,
    backgroundColor: "var(--card)",
    borderColor: "var(--border)",
    boxShadow: "none",
    "&:hover": {
      borderColor: "var(--border)",
    },
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    boxShadow:
      "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "var(--accent)"
      : state.isFocused
      ? "var(--accent)"
      : "var(--card)",
    color:
      state.isSelected || state.isFocused
        ? "var(--accent-foreground)"
        : "var(--foreground)",
    "&:active": {
      backgroundColor: "var(--accent)",
    },
  }),
  singleValue: (base: any) => ({
    ...base,
    color: "var(--foreground)",
  }),
  multiValue: (base: any) => ({
    ...base,
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  }),
  multiValueLabel: (base: any) => ({
    ...base,
    color: "var(--accent-foreground)",
  }),
  multiValueRemove: (base: any) => ({
    ...base,
    color: "var(--accent-foreground)",
    "&:hover": {
      backgroundColor: "var(--destructive)",
      color: "var(--destructive-foreground)",
    },
  }),
  input: (base: any) => ({
    ...base,
    color: "var(--foreground)",
  }),
  placeholder: (base: any) => ({
    ...base,
    color: "var(--muted-foreground)",
  }),
  clearIndicator: (base: any) => ({
    ...base,
    color: "var(--muted-foreground)",
    "&:hover": {
      color: "var(--foreground)",
    },
  }),
  dropdownIndicator: (base: any) => ({
    ...base,
    color: "var(--muted-foreground)",
    "&:hover": {
      color: "var(--foreground)",
    },
  }),
};

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
          <Select
            isMulti
            inputId="lawn_ids"
            name="lawn_ids"
            options={lawns.map((lawn) => ({
              value: lawn.id,
              label: lawn.name,
            }))}
            value={lawns
              .filter((lawn) => (form.lawn_ids || []).includes(lawn.id))
              .map((lawn) => ({ value: lawn.id, label: lawn.name }))}
            onChange={(opts) => {
              const selected = opts.map((o: any) => o.value);
              setForm((f) => ({
                ...f,
                lawn_ids: selected,
                lawn_id: selected.length === 1 ? selected[0] : "",
              }));
            }}
            isDisabled={submitting}
            classNamePrefix="react-select"
            styles={selectStyles}
            placeholder="Select lawn(s)..."
            required={(form.lawn_ids || []).length === 0}
          />
        </div>
        <div>
          <label
            className="block text-sm font-medium mb-1"
            htmlFor="product_id"
          >
            Product
          </label>
          <Select
            inputId="product_id"
            name="product_id"
            options={products
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((product) => ({
                value: product.id,
                label: product.name,
              }))}
            value={
              form.product_id
                ? products
                    .filter((p) => p.id === form.product_id)
                    .map((p) => ({ value: p.id, label: p.name }))
                : null
            }
            onChange={(opt) => {
              setForm((f) => ({
                ...f,
                product_id: opt?.value ?? "",
              }));
            }}
            isDisabled={submitting}
            classNamePrefix="react-select"
            styles={selectStyles}
            placeholder="Select product..."
            required
          />
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
          <Select
            inputId="unit"
            name="unit"
            options={UNIT_OPTIONS}
            value={UNIT_OPTIONS.find((opt) => opt.value === form.unit)}
            onChange={(opt) => {
              setForm((f) => ({
                ...f,
                unit: opt?.value ?? "lbs",
              }));
            }}
            isDisabled={submitting}
            classNamePrefix="react-select"
            styles={selectStyles}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="status">
            Status
          </label>
          <Select
            inputId="status"
            name="status"
            options={STATUS_OPTIONS}
            value={STATUS_OPTIONS.find((opt) => opt.value === form.status)}
            onChange={(opt) => {
              setForm((f) => ({
                ...f,
                status: opt?.value ?? "planned",
              }));
            }}
            isDisabled={submitting}
            classNamePrefix="react-select"
            styles={selectStyles}
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          value={form.notes}
          onChange={handleChange}
          disabled={submitting}
          className="w-full border rounded px-2 py-1 bg-card text-foreground border-border"
          rows={3}
        />
      </div>
      {form.lawn_ids?.length === 1 && (
        <div>
          <label
            className="block text-sm font-medium mb-1"
            htmlFor="tied_gdd_model_id"
          >
            GDD Model (optional)
          </label>
          <Select
            inputId="tied_gdd_model_id"
            name="tied_gdd_model_id"
            options={[
              { value: "", label: "None" },
              ...gddModels
                .filter((m) => m.lawn_id === form.lawn_ids![0])
                .map((m) => ({ value: m.id, label: m.name })),
            ]}
            value={
              form.tied_gdd_model_id
                ? gddModels
                    .filter((m) => m.id === form.tied_gdd_model_id)
                    .map((m) => ({ value: m.id, label: m.name }))[0]
                : { value: "", label: "None" }
            }
            onChange={(opt) => {
              setForm((f) => ({
                ...f,
                tied_gdd_model_id:
                  opt?.value === "" ? "" : Number(opt?.value) ?? "",
              }));
            }}
            isDisabled={submitting}
            classNamePrefix="react-select"
            styles={selectStyles}
          />
        </div>
      )}
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {mode === "add" ? "Add Application" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

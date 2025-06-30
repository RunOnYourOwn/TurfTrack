import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductFormValues } from "@/types/product";

type ProductFormProps = {
  initialValues?: Partial<ProductFormValues>;
  mode: "add" | "edit";
  submitting: boolean;
  error?: string | null;
  onSubmit: (values: ProductFormValues) => void;
  onCancel: () => void;
};

const nutrientFields = [
  ["n_pct", "N (%)"],
  ["p_pct", "P (%)"],
  ["k_pct", "K (%)"],
  ["ca_pct", "Ca (%)"],
  ["mg_pct", "Mg (%)"],
  ["s_pct", "S (%)"],
  ["fe_pct", "Fe (%)"],
  ["cu_pct", "Cu (%)"],
  ["mn_pct", "Mn (%)"],
  ["b_pct", "B (%)"],
  ["zn_pct", "Zn (%)"],
];

const advancedNFields = [
  ["urea_nitrogen", "Urea N"],
  ["ammoniacal_nitrogen", "Ammoniacal N"],
  ["water_insol_nitrogen", "Water Insoluble N"],
  ["other_water_soluble", "Other Water Soluble N"],
];

export function ProductForm({
  initialValues = {},
  mode,
  submitting,
  error,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const [form, setForm] = React.useState<ProductFormValues>({
    name: initialValues.name || "",
    product_link: initialValues.product_link || "",
    weight_lbs: initialValues.weight_lbs ?? undefined,
    cost_per_bag: initialValues.cost_per_bag ?? undefined,
    sgn: initialValues.sgn || "",
    label: initialValues.label || "",
    sources: initialValues.sources || "",
    n_pct: initialValues.n_pct ?? undefined,
    p_pct: initialValues.p_pct ?? undefined,
    k_pct: initialValues.k_pct ?? undefined,
    ca_pct: initialValues.ca_pct ?? undefined,
    mg_pct: initialValues.mg_pct ?? undefined,
    s_pct: initialValues.s_pct ?? undefined,
    fe_pct: initialValues.fe_pct ?? undefined,
    cu_pct: initialValues.cu_pct ?? undefined,
    mn_pct: initialValues.mn_pct ?? undefined,
    b_pct: initialValues.b_pct ?? undefined,
    zn_pct: initialValues.zn_pct ?? undefined,
    urea_nitrogen: initialValues.urea_nitrogen ?? undefined,
    ammoniacal_nitrogen: initialValues.ammoniacal_nitrogen ?? undefined,
    water_insol_nitrogen: initialValues.water_insol_nitrogen ?? undefined,
    other_water_soluble: initialValues.other_water_soluble ?? undefined,
    slowly_available_from: initialValues.slowly_available_from || "",
    last_scraped_price: initialValues.last_scraped_price ?? undefined,
    last_scraped_at: initialValues.last_scraped_at || "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type } = e.target;
    setForm((f) => ({
      ...f,
      [name]:
        type === "number" ? (value === "" ? undefined : Number(value)) : value,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* General Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="name">
            Name
          </label>
          <Input
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            disabled={submitting}
          />
        </div>
        <div>
          <label
            className="block text-sm font-medium mb-1"
            htmlFor="product_link"
          >
            Product Link
          </label>
          <Input
            id="product_link"
            name="product_link"
            value={form.product_link}
            onChange={handleChange}
            disabled={submitting}
          />
        </div>
        <div>
          <label
            className="block text-sm font-medium mb-1"
            htmlFor="weight_lbs"
          >
            Weight (lbs)
          </label>
          <Input
            id="weight_lbs"
            name="weight_lbs"
            type="number"
            step="any"
            value={form.weight_lbs ?? ""}
            onChange={handleChange}
            disabled={submitting}
          />
        </div>
        <div>
          <label
            className="block text-sm font-medium mb-1"
            htmlFor="cost_per_bag"
          >
            Cost per Bag ($)
          </label>
          <Input
            id="cost_per_bag"
            name="cost_per_bag"
            type="number"
            step="any"
            value={form.cost_per_bag ?? ""}
            onChange={handleChange}
            disabled={submitting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="sgn">
            SGN
          </label>
          <Input
            id="sgn"
            name="sgn"
            value={form.sgn}
            onChange={handleChange}
            disabled={submitting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="label">
            Label
          </label>
          <Input
            id="label"
            name="label"
            value={form.label}
            onChange={handleChange}
            disabled={submitting}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1" htmlFor="sources">
            Sources
          </label>
          <Input
            id="sources"
            name="sources"
            value={form.sources}
            onChange={handleChange}
            disabled={submitting}
          />
        </div>
      </div>

      {/* Nutrients Group */}
      <div>
        <div className="font-semibold mt-4 mb-2">Nutrients (%)</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {nutrientFields.map(([field, label]) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1" htmlFor={field}>
                {label}
              </label>
              <Input
                id={field}
                name={field}
                type="number"
                step="any"
                value={form[field as keyof ProductFormValues] ?? ""}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Advanced Nitrogen Fields */}
      <div>
        <div className="font-semibold mt-4 mb-2">
          Advanced Nitrogen (optional)
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {advancedNFields.map(([field, label]) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1" htmlFor={field}>
                {label}
              </label>
              <Input
                id={field}
                name={field}
                type="number"
                step="any"
                value={form[field as keyof ProductFormValues] ?? ""}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Slowly Available From */}
      <div>
        <label
          className="block text-sm font-medium mb-1"
          htmlFor="slowly_available_from"
        >
          Slowly Available From
        </label>
        <Input
          id="slowly_available_from"
          name="slowly_available_from"
          value={form.slowly_available_from}
          onChange={handleChange}
          disabled={submitting}
        />
      </div>

      {/* Scraping Info (read-only, edit mode) */}
      {mode === "edit" &&
        (form.last_scraped_price !== undefined || form.last_scraped_at) && (
          <div className="mt-4 p-2 bg-muted rounded">
            <div className="text-xs font-semibold mb-1">
              Scraping Info (read-only)
            </div>
            {form.last_scraped_price !== undefined && (
              <div className="text-xs">
                Last Scraped Price:{" "}
                <span className="font-mono">{form.last_scraped_price}</span>
              </div>
            )}
            {form.last_scraped_at && (
              <div className="text-xs">
                Last Scraped At:{" "}
                <span className="font-mono">{form.last_scraped_at}</span>
              </div>
            )}
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
          {submitting
            ? "Saving..."
            : mode === "add"
            ? "Add Product"
            : "Update Product"}
        </Button>
      </div>
    </form>
  );
}

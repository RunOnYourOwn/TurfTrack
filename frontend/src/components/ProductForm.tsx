import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type ProductFormValues = {
  name: string;
  product_link?: string;
  weight_lbs?: number;
  cost_per_bag?: number;
  sgn?: string;
  label?: string;
  sources?: string;
  n_pct?: number;
  p_pct?: number;
  k_pct?: number;
  ca_pct?: number;
  mg_pct?: number;
  s_pct?: number;
  fe_pct?: number;
  cu_pct?: number;
  mn_pct?: number;
  b_pct?: number;
  zn_pct?: number;
  urea_nitrogen?: number;
  ammoniacal_nitrogen?: number;
  water_insol_nitrogen?: number;
  other_water_soluble?: number;
  slowly_available_from?: string;
  last_scraped_price?: number;
  last_scraped_at?: string;
};

type ProductFormProps = {
  initialValues?: Partial<ProductFormValues>;
  mode: "add" | "edit";
  submitting: boolean;
  error?: string | null;
  onSubmit: (values: ProductFormValues) => void;
  onCancel: () => void;
};

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
    n_pct: initialValues.n_pct ?? 0,
    p_pct: initialValues.p_pct ?? 0,
    k_pct: initialValues.k_pct ?? 0,
    ca_pct: initialValues.ca_pct ?? 0,
    mg_pct: initialValues.mg_pct ?? 0,
    s_pct: initialValues.s_pct ?? 0,
    fe_pct: initialValues.fe_pct ?? 0,
    cu_pct: initialValues.cu_pct ?? 0,
    mn_pct: initialValues.mn_pct ?? 0,
    b_pct: initialValues.b_pct ?? 0,
    zn_pct: initialValues.zn_pct ?? 0,
    urea_nitrogen: initialValues.urea_nitrogen ?? 0,
    ammoniacal_nitrogen: initialValues.ammoniacal_nitrogen ?? 0,
    water_insol_nitrogen: initialValues.water_insol_nitrogen ?? 0,
    other_water_soluble: initialValues.other_water_soluble ?? 0,
    slowly_available_from: initialValues.slowly_available_from || "",
    last_scraped_price: initialValues.last_scraped_price,
    last_scraped_at: initialValues.last_scraped_at,
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
      <div className="grid grid-cols-2 gap-4">
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
            Cost/Bag
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
        <div>
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
        <div className="font-semibold mt-4 mb-2">Nutrients</div>
        <div className="grid grid-cols-6 gap-2">
          {[
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
            ["urea_nitrogen", "Urea N"],
            ["ammoniacal_nitrogen", "Ammoniacal N"],
            ["water_insol_nitrogen", "Water Insoluble N"],
            ["other_water_soluble", "Other Water Soluble"],
          ].map(([key, label]) => (
            <div key={key as string}>
              <label
                className="block text-xs font-medium mb-1"
                htmlFor={key as string}
              >
                {label}
              </label>
              <Input
                id={key as string}
                name={key as string}
                type="number"
                step="any"
                value={form[key as keyof ProductFormValues] ?? ""}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>
          ))}
        </div>
        <div className="mt-2">
          <label
            className="block text-xs font-medium mb-1"
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
      </div>
      {/* Read-only fields for edit mode */}
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
      <div className="flex gap-2 justify-end mt-4">
        <Button type="submit" disabled={submitting}>
          {submitting
            ? mode === "add"
              ? "Adding..."
              : "Saving..."
            : mode === "add"
            ? "Add Product"
            : "Save Changes"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

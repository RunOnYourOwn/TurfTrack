export interface Product {
  id: number;
  name: string;
  description?: string;
  n_percent: number;
  p_percent: number;
  k_percent: number;
  ca_percent?: number;
  mg_percent?: number;
  s_percent?: number;
  fe_percent?: number;
  cu_percent?: number;
  mn_percent?: number;
  b_percent?: number;
  zn_percent?: number;
  cost_per_lb: number;
  cost_per_lb_n: number;
  created_at: string;
  updated_at: string;
}

// This type should match all fields used in the ProductForm component
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

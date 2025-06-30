export interface Application {
  id: number;
  application_date: string;
  lawn_id: number;
  product_id: number;
  amount_per_area: number;
  unit: string;
  area_unit: string;
  status: string;
  notes?: string;
  tied_gdd_model_id?: number | null;
  n_applied?: number;
  p_applied?: number;
  k_applied?: number;
  ca_applied?: number;
  mg_applied?: number;
  s_applied?: number;
  fe_applied?: number;
  cu_applied?: number;
  mn_applied?: number;
  b_applied?: number;
  zn_applied?: number;
  cost_applied?: number;
  created_at: string;
  updated_at: string;
}

export interface ApplicationFormValues {
  application_date: string;
  lawn_id: string;
  product_id: string;
  amount_per_area: string;
  unit: string;
  area_unit: string;
  status: string;
  notes: string;
  tied_gdd_model_id?: string;
}

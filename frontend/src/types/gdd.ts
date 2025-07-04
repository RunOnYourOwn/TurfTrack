export interface GDDModel {
  id: number;
  name: string;
  base_temp: number;
  unit: "C" | "F";
  start_date: string;
  threshold: number;
  reset_on_threshold: boolean;
  location_id: number;
  created_at: string;
  updated_at: string;
  location?: Location;
}

export interface GDDValue {
  id: number;
  gdd_model_id: number;
  date: string;
  daily_gdd: number;
  cumulative_gdd: number;
  run: number;
  created_at: string;
}

export interface GDDReset {
  id: number;
  gdd_model_id: number;
  reset_date: string;
  reset_type: "manual" | "threshold";
  run_number: number;
  created_at: string;
}

export interface GDDParameterHistory {
  id: number;
  gdd_model_id: number;
  base_temp: number;
  threshold: number;
  reset_on_threshold: boolean;
  effective_from: string;
  created_at: string;
}

export interface GDDFormValues {
  name: string;
  base_temp: string;
  unit: "C" | "F";
  start_date: string;
  threshold: string;
  reset_on_threshold: boolean;
}

export interface GDDParameterEditFormValues {
  base_temp: string;
  threshold: string;
  reset_on_threshold: boolean;
  recalculate_history: boolean;
  effective_from: string;
  replace_all_history: boolean;
}

export interface GDDModelDashboard {
  id: number;
  location_id: number;
  name: string;
  base_temp: number;
  unit: string;
  threshold: number;
  created_at: string;
  updated_at: string;
  current_gdd?: number;
  last_reset?: string;
  run_number?: number;
}

// Import Location type from location.ts
import { Location } from "./location";

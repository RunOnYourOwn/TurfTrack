export interface WeeklyWaterSummary {
  week_start: string;
  week_end: string;
  et0_total: number;
  precipitation_total: number;
  irrigation_applied: number;
  water_deficit: number;
  status: "good" | "warning" | "critical" | "excellent";
  is_forecast: boolean;
}

export interface WaterManagementSummary {
  lawn_id: number;
  current_week: WeeklyWaterSummary | null;
  weekly_data: WeeklyWaterSummary[];
  total_monthly_water: number;
}

export interface IrrigationEntry {
  id?: number;
  date: string;
  amount: number;
  duration: number;
  notes?: string;
  source: "manual" | "automatic" | "scheduled";
}

export interface WeatherData {
  date: string;
  type: string;
  precipitation_in: number;
  et0_evapotranspiration_in: number;
  relative_humidity_mean: number | null;
}

export type WaterStatus = "good" | "warning" | "critical" | "excellent";
export type IrrigationSource = "manual" | "automatic" | "scheduled";

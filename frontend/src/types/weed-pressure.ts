export interface WeedSpecies {
  id: number;
  name: string;
  common_name: string;
  gdd_base_temp_c: number;
  gdd_threshold_emergence: number;
  optimal_soil_temp_min_c: number;
  optimal_soil_temp_max_c: number;
  moisture_preference: "low" | "medium" | "high";
  season: "spring" | "summer" | "fall" | "year_round";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WeedPressure {
  id: number;
  location_id: number;
  date: string;
  weed_species_id: number;
  weed_pressure_score: number;
  gdd_risk_score: number;
  soil_temp_risk_score: number;
  moisture_risk_score: number;
  turf_stress_score: number;
  seasonal_timing_score: number;
  gdd_accumulated: number;
  soil_temp_estimate_c: number;
  precipitation_3day_mm: number;
  humidity_avg: number;
  et0_mm: number;
  is_forecast: boolean;
  created_at: string;
  weed_species: WeedSpecies;
}

export interface WeedPressureChartDataPoint {
  date: string;
  pressure_score: number;
  gdd_accumulated: number;
  is_forecast: boolean;
}

export interface WeedPressureChartSpecies {
  species_id: number;
  species_name: string;
  common_name: string;
  data_points: WeedPressureChartDataPoint[];
}

export interface WeedPressureChartResponse {
  location_id: number;
  date_range: {
    start_date: string;
    end_date: string;
  };
  species_data: WeedPressureChartSpecies[];
  current_status: {
    highest_pressure: number;
    status: string;
    recommendations: string[];
  };
}

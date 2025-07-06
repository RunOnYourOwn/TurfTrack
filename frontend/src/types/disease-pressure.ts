export interface DiseasePressure {
  id: number;
  date: string;
  location_id: number;
  disease: string;
  risk_score: number;
  created_at?: string;
  type: string; // 'historical' or 'forecast'
  is_forecast?: boolean;
}

export interface DiseasePressureList {
  id: number;
  date: string;
  location_id: number;
  disease: string;
  risk_score: number;
  type: string; // 'historical' or 'forecast'
  is_forecast?: boolean;
}

export type DiseaseType = "smith_kerns" | "general";

export interface DiseasePressureFilters {
  start_date?: string;
  end_date?: string;
  disease?: DiseaseType;
}

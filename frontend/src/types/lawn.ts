import { Location } from "./location";

export interface Lawn {
  id: number;
  name: string;
  area: number;
  grass_type: "cold_season" | "warm_season";
  notes?: string;
  weather_fetch_frequency: "4h" | "8h" | "12h" | "24h";
  timezone: string;
  weather_enabled: boolean;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
  updated_at: string;
  location?: Location;
}

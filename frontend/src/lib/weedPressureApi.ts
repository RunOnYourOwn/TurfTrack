import axios from "./axios";
import {
  WeedSpecies,
  WeedPressure,
  WeedPressureChartResponse,
} from "../types/weed-pressure";

export async function fetchWeedSpecies(): Promise<WeedSpecies[]> {
  const res = await axios.get("/api/v1/weed-pressure/species");
  return res.data;
}

export async function fetchCurrentWeedPressure(
  locationId: number,
  date?: string
): Promise<WeedPressure[]> {
  const params = date ? { target_date: date } : {};
  const res = await axios.get(
    `/api/v1/weed-pressure/location/${locationId}/current`,
    { params }
  );
  return res.data;
}

export interface WeedPressureChartParams {
  start_date: string;
  end_date: string;
  species_ids?: number[];
  include_forecast?: boolean;
}

export async function fetchWeedPressureChart(
  locationId: number,
  params: WeedPressureChartParams
): Promise<WeedPressureChartResponse> {
  const res = await axios.post(
    `/api/v1/weed-pressure/location/${locationId}/chart`,
    params
  );
  return res.data;
}

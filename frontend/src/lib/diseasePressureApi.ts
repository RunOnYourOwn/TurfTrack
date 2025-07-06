import { get } from "./fetcher";
import { DiseasePressureList, DiseasePressureFilters } from "../types";

const API_BASE = "/api/v1/disease_pressure";

export const diseasePressureApi = {
  // Get disease pressure for a specific lawn
  getForLawn: async (
    lawnId: number,
    filters?: DiseasePressureFilters
  ): Promise<DiseasePressureList[]> => {
    const params = new URLSearchParams();

    if (filters?.start_date) {
      params.append("start_date", filters.start_date);
    }
    if (filters?.end_date) {
      params.append("end_date", filters.end_date);
    }
    if (filters?.disease) {
      params.append("disease", filters.disease);
    }

    const queryString = params.toString();
    const url = `${API_BASE}/lawn/${lawnId}${
      queryString ? `?${queryString}` : ""
    }`;

    return get<DiseasePressureList[]>(url);
  },

  // Get disease pressure for a specific location
  getForLocation: async (
    locationId: number,
    filters?: DiseasePressureFilters
  ): Promise<DiseasePressureList[]> => {
    const params = new URLSearchParams();

    if (filters?.start_date) {
      params.append("start_date", filters.start_date);
    }
    if (filters?.end_date) {
      params.append("end_date", filters.end_date);
    }
    if (filters?.disease) {
      params.append("disease", filters.disease);
    }

    const queryString = params.toString();
    const url = `${API_BASE}/location/${locationId}${
      queryString ? `?${queryString}` : ""
    }`;

    return get<DiseasePressureList[]>(url);
  },
};

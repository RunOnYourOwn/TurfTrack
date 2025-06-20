import axiosInstance from "./axios";
import { AxiosRequestConfig, AxiosResponse } from "axios";

// Generic fetcher for all HTTP methods
export async function fetcher<T = any>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const response: AxiosResponse<T> = await axiosInstance.request({
    url,
    ...config,
  });
  return response.data;
}

// Shorthand for GET requests
export const get = async <T = any>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  return fetcher<T>(url, { ...config, method: "GET" });
};

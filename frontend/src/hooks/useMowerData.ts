import { useQuery } from "@tanstack/react-query";
import { fetcher } from "../lib/fetcher";
import { MowerRead } from "../types/mower";

export const useMowerData = (selectedMowerId: string) => {
  // Fetch all mowers
  const { data: mowers, error } = useQuery({
    queryKey: ["mowers"],
    queryFn: () => fetcher("/api/v1/mowers/"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch mowing logs for selected mower
  const { data: mowingLogs } = useQuery({
    queryKey: ["mowing-logs", selectedMowerId],
    queryFn: () =>
      selectedMowerId
        ? fetcher(`/api/v1/mowers/${selectedMowerId}/mowing-logs`)
        : Promise.resolve([]),
    enabled: !!selectedMowerId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch lawns to match lawn names
  const { data: lawns } = useQuery({
    queryKey: ["lawns"],
    queryFn: () => fetcher("/api/v1/lawns/"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch maintenance schedules for selected mower
  const { data: maintenanceSchedules } = useQuery({
    queryKey: ["maintenance-schedules", selectedMowerId],
    queryFn: () =>
      selectedMowerId
        ? fetcher(`/api/v1/mowers/${selectedMowerId}/maintenance-schedules`)
        : Promise.resolve([]),
    enabled: !!selectedMowerId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch maintenance logs for selected mower
  const { data: maintenanceLogs } = useQuery({
    queryKey: ["maintenance-logs", selectedMowerId],
    queryFn: () =>
      selectedMowerId
        ? fetcher(`/api/v1/mowers/${selectedMowerId}/maintenance-logs`)
        : Promise.resolve([]),
    enabled: !!selectedMowerId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Get selected mower
  const selectedMower =
    mowers?.find((m: MowerRead) => m.id.toString() === selectedMowerId) || null;

  return {
    mowers,
    mowingLogs,
    lawns,
    maintenanceSchedules,
    maintenanceLogs,
    selectedMower,
    error,
  };
};

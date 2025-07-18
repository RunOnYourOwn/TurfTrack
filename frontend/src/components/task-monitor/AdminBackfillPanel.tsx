import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import React from "react";
import { fetcher } from "@/lib/fetcher";

interface MissingRange {
  start: string;
  end: string;
}

interface GDDMissing {
  gdd_model_id: number;
  missing: MissingRange[];
}

interface LocationDataHealth {
  id: number;
  name: string;
  missing: {
    weather: MissingRange[];
    gdd: GDDMissing[];
    disease_pressure: MissingRange[];
    growth_potential: MissingRange[];
  };
}

interface DuplicateWeatherEntry {
  id: number;
  type: string;
  temperature_max_c: number;
  temperature_min_c: number;
}

interface DuplicateWeatherDate {
  date: string;
  entries: DuplicateWeatherEntry[];
}

interface DataHealthResponse {
  locations: LocationDataHealth[];
  duplicate_weather: Record<string, DuplicateWeatherDate[]>;
}

// API helpers
async function backfillWeather(
  location_id: number,
  start: string,
  end: string
) {
  return fetcher("/api/v1/backfill/weather/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: { location_id, start_date: start, end_date: end },
  });
}
async function backfillGDD(gdd_model_id: number) {
  return fetcher("/api/v1/backfill/gdd/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: { gdd_model_id },
  });
}
async function backfillDiseasePressure(
  location_id: number,
  start: string,
  end: string
) {
  return fetcher("/api/v1/backfill/disease_pressure/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: { location_id, start_date: start, end_date: end },
  });
}
async function backfillGrowthPotential(
  location_id: number,
  start: string,
  end: string
) {
  return fetcher("/api/v1/backfill/growth_potential/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: { location_id, start_date: start, end_date: end },
  });
}

async function cleanupDuplicateWeather(location_id: number) {
  return fetcher("/api/v1/backfill/cleanup_duplicate_weather/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: { location_id },
  });
}

// Polling hook for task status
function useTaskStatusPolling(
  taskId: string | null,
  onComplete: (status: string) => void
) {
  React.useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    let interval: NodeJS.Timeout;
    console.log("[Polling] Started for taskId:", taskId);
    async function checkStatus() {
      try {
        const data = await fetcher(`/api/v1/tasks/${taskId}`);
        console.log(
          "[Polling] First check for",
          taskId,
          "status:",
          data.status,
          "full:",
          data
        );
        if (data.status === "success" || data.status === "failed") {
          console.log(
            "[Polling] onComplete called for",
            taskId,
            "with status:",
            data.status
          );
          if (!cancelled) onComplete(data.status);
        } else {
          interval = setTimeout(poll, 300);
        }
      } catch (e) {
        console.log("[Polling] Exception in checkStatus for", taskId, e);
        interval = setTimeout(poll, 300);
      }
    }
    async function poll() {
      if (cancelled) return;
      try {
        const data = await fetcher(`/api/v1/tasks/${taskId}`);
        console.log(
          "[Polling] Poll for",
          taskId,
          "status:",
          data.status,
          "full:",
          data
        );
        if (data.status === "success" || data.status === "failed") {
          console.log(
            "[Polling] onComplete called for",
            taskId,
            "with status:",
            data.status
          );
          if (!cancelled) onComplete(data.status);
        } else {
          interval = setTimeout(poll, 300);
        }
      } catch (e) {
        console.log("[Polling] Exception in poll for", taskId, e);
        interval = setTimeout(poll, 300);
      }
    }
    checkStatus();
    return () => {
      cancelled = true;
      if (interval) clearTimeout(interval);
      console.log("[Polling] Stopped for taskId:", taskId);
    };
  }, [taskId, onComplete]);
}

export function AdminBackfillPanel() {
  const queryClient = useQueryClient();
  const [activeLocation, setActiveLocation] = React.useState<number | null>(
    null
  );
  const [pollingTaskId, setPollingTaskId] = React.useState<string | null>(null);
  const { data, isLoading, error } = useQuery<DataHealthResponse>({
    queryKey: ["dataHealth"],
    queryFn: async () => {
      return fetcher("/api/v1/data_health/");
    },
  });

  // When pollingTaskId is set, poll for completion
  useTaskStatusPolling(
    pollingTaskId,
    React.useCallback(
      (status) => {
        setPollingTaskId(null);
        queryClient.invalidateQueries({ queryKey: ["dataHealth"] });
        if (status === "success") {
          toast.success("Backfill complete! Data has been refreshed.");
        } else {
          toast.error("Backfill failed. Please try again.");
        }
      },
      [queryClient]
    )
  );

  // Mutations for each type
  const weatherMutation = useMutation({
    mutationFn: ({
      location_id,
      start,
      end,
    }: {
      location_id: number;
      start: string;
      end: string;
    }) => backfillWeather(location_id, start, end),
    onMutate: (vars) => setActiveLocation(vars.location_id),
    onSettled: () => setActiveLocation(null),
    onSuccess: (data) => {
      setPollingTaskId(data.task_id);
      toast.success("Weather backfill started. Waiting for completion...");
    },
    onError: (err: any) => {
      toast.error(
        "Weather backfill failed: " + (err?.message || "Unknown error")
      );
    },
  });
  const gddMutation = useMutation({
    mutationFn: (gdd_model_id: number) => backfillGDD(gdd_model_id),
    onMutate: () => setActiveLocation(null), // GDD is per model, not per location
    onSettled: () => setActiveLocation(null),
    onSuccess: (data) => {
      setPollingTaskId(data.task_id);
      toast.success("GDD backfill started. Waiting for completion...");
    },
    onError: (err: any) => {
      toast.error("GDD backfill failed: " + (err?.message || "Unknown error"));
    },
  });
  const diseaseMutation = useMutation({
    mutationFn: ({
      location_id,
      start,
      end,
    }: {
      location_id: number;
      start: string;
      end: string;
    }) => backfillDiseasePressure(location_id, start, end),
    onMutate: (vars) => setActiveLocation(vars.location_id),
    onSettled: () => setActiveLocation(null),
    onSuccess: (data) => {
      setPollingTaskId(data.task_id);
      toast.success(
        "Disease pressure backfill started. Waiting for completion..."
      );
    },
    onError: (err: any) => {
      toast.error(
        "Disease pressure backfill failed: " + (err?.message || "Unknown error")
      );
    },
  });
  const growthMutation = useMutation({
    mutationFn: ({
      location_id,
      start,
      end,
    }: {
      location_id: number;
      start: string;
      end: string;
    }) => backfillGrowthPotential(location_id, start, end),
    onMutate: (vars) => setActiveLocation(vars.location_id),
    onSettled: () => setActiveLocation(null),
    onSuccess: (data) => {
      setPollingTaskId(data.task_id);
      toast.success(
        "Growth potential backfill started. Waiting for completion..."
      );
    },
    onError: (err: any) => {
      toast.error(
        "Growth potential backfill failed: " + (err?.message || "Unknown error")
      );
    },
  });

  const duplicateCleanupMutation = useMutation({
    mutationFn: (location_id: number) => cleanupDuplicateWeather(location_id),
    onMutate: (location_id) => setActiveLocation(location_id),
    onSettled: () => setActiveLocation(null),
    onSuccess: (data) => {
      setPollingTaskId(data.task_id);
      toast.success(
        "Duplicate weather cleanup started. Waiting for completion..."
      );
    },
    onError: (err: any) => {
      toast.error(
        "Duplicate weather cleanup failed: " + (err?.message || "Unknown error")
      );
    },
  });

  if (isLoading) return <div>Loading data health...</div>;
  if (error) return <div>Error loading data health</div>;

  return (
    <Card className="mb-6 bg-white dark:bg-gray-900 text-black dark:text-white w-full max-w-none shadow-lg flex flex-col">
      <CardHeader>
        <CardTitle>Data Health & Backfill</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          {data?.locations.map((loc) => {
            // Determine if any mutation is running for this location
            const isLocPending =
              activeLocation === loc.id &&
              (weatherMutation.isPending ||
                diseaseMutation.isPending ||
                growthMutation.isPending ||
                duplicateCleanupMutation.isPending);
            return (
              <Card
                key={loc.id}
                className="bg-muted dark:bg-gray-800 border border-border p-4"
              >
                <div className="font-semibold text-lg mb-2">{loc.name}</div>
                <div className="flex flex-col gap-3">
                  {/* Weather */}
                  {loc.missing.weather.length > 0 && (
                    <div className="flex items-center justify-between bg-background dark:bg-gray-900 rounded-md p-3 border border-border mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Weather</span>
                        {loc.missing.weather.map((range, i) => (
                          <Badge key={i} variant="secondary" className="ml-1">
                            {range.start} to {range.end}
                          </Badge>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        className="ml-2"
                        disabled={isLocPending || weatherMutation.isPending}
                        onClick={() => {
                          const min = loc.missing.weather.reduce((a, b) =>
                            a.start < b.start ? a : b
                          ).start;
                          const max = loc.missing.weather.reduce((a, b) =>
                            a.end > b.end ? a : b
                          ).end;
                          weatherMutation.mutate({
                            location_id: loc.id,
                            start: min,
                            end: max,
                          });
                        }}
                      >
                        {weatherMutation.isPending &&
                        activeLocation === loc.id ? (
                          <span className="flex items-center gap-1">
                            <span className="animate-spin">⏳</span>{" "}
                            Backfilling...
                          </span>
                        ) : (
                          "Backfill"
                        )}
                      </Button>
                    </div>
                  )}
                  {/* GDD */}
                  {loc.missing.gdd.map((gdd) =>
                    gdd.missing.length > 0 ? (
                      <div
                        key={`gdd-${gdd.gdd_model_id}`}
                        className="flex items-center justify-between bg-background dark:bg-gray-900 rounded-md p-3 border border-border mb-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            GDD Model {gdd.gdd_model_id}
                          </span>
                          {gdd.missing.map((range, i) => (
                            <Badge key={i} variant="secondary" className="ml-1">
                              {range.start} to {range.end}
                            </Badge>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          className="ml-2"
                          disabled={gddMutation.isPending}
                          onClick={() => gddMutation.mutate(gdd.gdd_model_id)}
                        >
                          {gddMutation.isPending ? (
                            <span className="flex items-center gap-1">
                              <span className="animate-spin">⏳</span>{" "}
                              Backfilling...
                            </span>
                          ) : (
                            "Backfill"
                          )}
                        </Button>
                      </div>
                    ) : null
                  )}
                  {/* Disease Pressure */}
                  {loc.missing.disease_pressure.length > 0 && (
                    <div className="flex items-center justify-between bg-background dark:bg-gray-900 rounded-md p-3 border border-border mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Disease Pressure</span>
                        {loc.missing.disease_pressure.map((range, i) => (
                          <Badge key={i} variant="secondary" className="ml-1">
                            {range.start} to {range.end}
                          </Badge>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        className="ml-2"
                        disabled={isLocPending || diseaseMutation.isPending}
                        onClick={() => {
                          const min = loc.missing.disease_pressure.reduce(
                            (a, b) => (a.start < b.start ? a : b)
                          ).start;
                          const max = loc.missing.disease_pressure.reduce(
                            (a, b) => (a.end > b.end ? a : b)
                          ).end;
                          diseaseMutation.mutate({
                            location_id: loc.id,
                            start: min,
                            end: max,
                          });
                        }}
                      >
                        {diseaseMutation.isPending &&
                        activeLocation === loc.id ? (
                          <span className="flex items-center gap-1">
                            <span className="animate-spin">⏳</span>{" "}
                            Backfilling...
                          </span>
                        ) : (
                          "Backfill"
                        )}
                      </Button>
                    </div>
                  )}
                  {/* Growth Potential */}
                  {loc.missing.growth_potential.length > 0 && (
                    <div className="flex items-center justify-between bg-background dark:bg-gray-900 rounded-md p-3 border border-border mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Growth Potential</span>
                        {loc.missing.growth_potential.map((range, i) => (
                          <Badge key={i} variant="secondary" className="ml-1">
                            {range.start} to {range.end}
                          </Badge>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        className="ml-2"
                        disabled={isLocPending || growthMutation.isPending}
                        onClick={() => {
                          const min = loc.missing.growth_potential.reduce(
                            (a, b) => (a.start < b.start ? a : b)
                          ).start;
                          const max = loc.missing.growth_potential.reduce(
                            (a, b) => (a.end > b.end ? a : b)
                          ).end;
                          growthMutation.mutate({
                            location_id: loc.id,
                            start: min,
                            end: max,
                          });
                        }}
                      >
                        {growthMutation.isPending &&
                        activeLocation === loc.id ? (
                          <span className="flex items-center gap-1">
                            <span className="animate-spin">⏳</span>{" "}
                            Backfilling...
                          </span>
                        ) : (
                          "Backfill"
                        )}
                      </Button>
                    </div>
                  )}
                  {/* Duplicate Weather */}
                  {data.duplicate_weather[loc.id.toString()] &&
                    data.duplicate_weather[loc.id.toString()].length > 0 && (
                      <div className="flex items-center justify-between bg-background dark:bg-gray-900 rounded-md p-3 border border-border mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Duplicate Weather</span>
                          {data.duplicate_weather[loc.id.toString()].map(
                            (duplicate, i) => (
                              <Badge
                                key={i}
                                variant="destructive"
                                className="ml-1"
                              >
                                {duplicate.date} ({duplicate.entries.length}{" "}
                                entries)
                              </Badge>
                            )
                          )}
                        </div>
                        <Button
                          size="sm"
                          className="ml-2"
                          variant="destructive"
                          disabled={
                            isLocPending || duplicateCleanupMutation.isPending
                          }
                          onClick={() => {
                            duplicateCleanupMutation.mutate(loc.id);
                          }}
                        >
                          {duplicateCleanupMutation.isPending &&
                          activeLocation === loc.id ? (
                            <span className="flex items-center gap-1">
                              <span className="animate-spin">⏳</span>{" "}
                              Cleaning...
                            </span>
                          ) : (
                            "Clean Up"
                          )}
                        </Button>
                      </div>
                    )}
                </div>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

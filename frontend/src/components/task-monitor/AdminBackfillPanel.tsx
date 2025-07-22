import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import React from "react";
import { fetcher } from "@/lib/fetcher";
import {
  MapPin,
  Cloud,
  Thermometer,
  Bug,
  Sprout,
  Flower2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  RefreshCw,
  Database,
  Activity,
} from "lucide-react";

interface MissingRange {
  start: string;
  end: string;
}

interface GDDMissing {
  gdd_model_id: number;
  missing: MissingRange[];
}

interface WeedPressureMissing {
  species_id: number;
  species_name: string;
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
    weed_pressure: WeedPressureMissing[];
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

async function triggerWeatherUpdate() {
  return fetcher("/api/v1/tasks/trigger-weather-update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
async function backfillWeedPressure(
  location_id: number,
  start: string,
  end: string
) {
  return fetcher("/api/v1/backfill/weed_pressure/", {
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

  const weedPressureMutation = useMutation({
    mutationFn: ({
      location_id,
      start,
      end,
    }: {
      location_id: number;
      start: string;
      end: string;
    }) => backfillWeedPressure(location_id, start, end),
    onMutate: (vars) => setActiveLocation(vars.location_id),
    onSettled: () => setActiveLocation(null),
    onSuccess: (data) => {
      setPollingTaskId(data.task_id);
      toast.success(
        "Weed pressure backfill started. Waiting for completion..."
      );
    },
    onError: (err: any) => {
      toast.error(
        "Weed pressure backfill failed: " + (err?.message || "Unknown error")
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

  const weatherUpdateMutation = useMutation({
    mutationFn: triggerWeatherUpdate,
    onSuccess: (data) => {
      setPollingTaskId(data.task_id);
      toast.success("Weather update triggered. Waiting for completion...");
    },
    onError: (err: any) => {
      toast.error(
        "Weather update failed: " + (err?.message || "Unknown error")
      );
    },
  });

  if (isLoading)
    return (
      <Card className="mb-6 bg-white dark:bg-gray-900 text-black dark:text-white w-full max-w-none shadow-lg flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Health & Backfill
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Loading data health information...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );

  if (error)
    return (
      <Card className="mb-6 bg-white dark:bg-gray-900 text-black dark:text-white w-full max-w-none shadow-lg flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Health & Backfill
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-red-500">
              <XCircle className="w-4 h-4" />
              <span>Error loading data health information</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );

  // Calculate overall health metrics
  const totalLocations = data?.locations.length || 0;
  const totalMissingDataPoints =
    data?.locations.reduce((total, loc) => {
      return (
        total +
        loc.missing.weather.length +
        loc.missing.gdd.reduce((sum, gdd) => sum + gdd.missing.length, 0) +
        loc.missing.disease_pressure.length +
        loc.missing.growth_potential.length +
        loc.missing.weed_pressure.reduce(
          (sum, wp) => sum + wp.missing.length,
          0
        )
      );
    }, 0) || 0;

  return (
    <Card className="mb-6 bg-white dark:bg-gray-900 text-black dark:text-white w-full max-w-none shadow-lg flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Data Health & Backfill
            </CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>{totalLocations} locations</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span>{totalMissingDataPoints} missing data points</span>
              </div>
            </div>
          </div>
          <Button
            onClick={() => weatherUpdateMutation.mutate()}
            disabled={weatherUpdateMutation.isPending}
            className="flex items-center gap-2"
          >
            {weatherUpdateMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4" />
                Update Weather
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          {data?.locations.map((loc) => {
            // Calculate location health metrics
            const locationMissingData =
              loc.missing.weather.length +
              loc.missing.gdd.reduce(
                (sum, gdd) => sum + gdd.missing.length,
                0
              ) +
              loc.missing.disease_pressure.length +
              loc.missing.growth_potential.length +
              loc.missing.weed_pressure.reduce(
                (sum, wp) => sum + wp.missing.length,
                0
              );

            const healthPercentage =
              locationMissingData === 0
                ? 100
                : Math.max(0, 100 - locationMissingData * 10);
            const healthStatus =
              healthPercentage >= 90
                ? "good"
                : healthPercentage >= 70
                ? "warning"
                : "critical";

            // Determine if any mutation is running for this location
            const isLocPending =
              activeLocation === loc.id &&
              (weatherMutation.isPending ||
                diseaseMutation.isPending ||
                growthMutation.isPending ||
                weedPressureMutation.isPending ||
                duplicateCleanupMutation.isPending);

            // Gather all missing weed pressure ranges for this location
            const allWeedRanges = (loc.missing.weed_pressure || []).flatMap(
              (wp) => wp.missing
            );

            return (
              <Collapsible key={loc.id}>
                <Card className="bg-muted dark:bg-gray-800 border border-border overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <div className="font-semibold text-lg">
                            {loc.name}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>
                              {locationMissingData} missing data points
                            </span>
                            <span>•</span>
                            <span
                              className={`flex items-center gap-1 ${
                                healthStatus === "good"
                                  ? "text-green-500"
                                  : healthStatus === "warning"
                                  ? "text-yellow-500"
                                  : "text-red-500"
                              }`}
                            >
                              {healthStatus === "good" ? (
                                <CheckCircle className="w-3 h-3" />
                              ) : healthStatus === "warning" ? (
                                <AlertTriangle className="w-3 h-3" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              {healthPercentage}% healthy
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              healthStatus === "good"
                                ? "bg-green-500"
                                : healthStatus === "warning"
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${healthPercentage}%` }}
                          />
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-3">
                      {/* Weather */}
                      {loc.missing.weather.length > 0 && (
                        <div className="flex items-center justify-between bg-background dark:bg-gray-900 rounded-md p-3 border border-border">
                          <div className="flex items-center gap-3">
                            <Cloud className="w-4 h-4 text-blue-500" />
                            <div>
                              <div className="font-medium">Weather Data</div>
                              <div className="flex items-center gap-1 mt-1">
                                {loc.missing.weather.map((range, i) => (
                                  <Badge
                                    key={i}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {range.start} to {range.end}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
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
                                <RefreshCw className="w-3 h-3 animate-spin" />
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
                            className="flex items-center justify-between bg-background dark:bg-gray-900 rounded-md p-3 border border-border"
                          >
                            <div className="flex items-center gap-3">
                              <Thermometer className="w-4 h-4 text-orange-500" />
                              <div>
                                <div className="font-medium">
                                  GDD Model {gdd.gdd_model_id}
                                </div>
                                <div className="flex items-center gap-1 mt-1">
                                  {gdd.missing.map((range, i) => (
                                    <Badge
                                      key={i}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {range.start} to {range.end}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              disabled={gddMutation.isPending}
                              onClick={() =>
                                gddMutation.mutate(gdd.gdd_model_id)
                              }
                            >
                              {gddMutation.isPending ? (
                                <span className="flex items-center gap-1">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
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
                        <div className="flex items-center justify-between bg-background dark:bg-gray-900 rounded-md p-3 border border-border">
                          <div className="flex items-center gap-3">
                            <Bug className="w-4 h-4 text-red-500" />
                            <div>
                              <div className="font-medium">
                                Disease Pressure
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                {loc.missing.disease_pressure.map(
                                  (range, i) => (
                                    <Badge
                                      key={i}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {range.start} to {range.end}
                                    </Badge>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
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
                                <RefreshCw className="w-3 h-3 animate-spin" />
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
                        <div className="flex items-center justify-between bg-background dark:bg-gray-900 rounded-md p-3 border border-border">
                          <div className="flex items-center gap-3">
                            <Sprout className="w-4 h-4 text-green-500" />
                            <div>
                              <div className="font-medium">
                                Growth Potential
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                {loc.missing.growth_potential.map(
                                  (range, i) => (
                                    <Badge
                                      key={i}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {range.start} to {range.end}
                                    </Badge>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
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
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                Backfilling...
                              </span>
                            ) : (
                              "Backfill"
                            )}
                          </Button>
                        </div>
                      )}
                      {/* Weed Pressure */}
                      {allWeedRanges.length > 0 && (
                        <div className="flex items-center justify-between bg-background dark:bg-gray-900 rounded-md p-3 border border-border">
                          <div className="flex items-center gap-3">
                            <Flower2 className="w-4 h-4 text-purple-500" />
                            <div>
                              <div className="font-medium">Weed Pressure</div>
                              <div className="flex items-center gap-1 mt-1">
                                {allWeedRanges.map((range, i) => (
                                  <Badge
                                    key={i}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {range.start} to {range.end}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={
                              isLocPending || weedPressureMutation.isPending
                            }
                            onClick={() => {
                              const min = allWeedRanges.reduce((a, b) =>
                                a.start < b.start ? a : b
                              ).start;
                              const max = allWeedRanges.reduce((a, b) =>
                                a.end > b.end ? a : b
                              ).end;
                              weedPressureMutation.mutate({
                                location_id: loc.id,
                                start: min,
                                end: max,
                              });
                            }}
                          >
                            {weedPressureMutation.isPending &&
                            activeLocation === loc.id ? (
                              <span className="flex items-center gap-1">
                                <RefreshCw className="w-3 h-3 animate-spin" />
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
                        data.duplicate_weather[loc.id.toString()].length >
                          0 && (
                          <div className="flex items-center justify-between bg-background dark:bg-gray-900 rounded-md p-3 border border-border">
                            <div className="flex items-center gap-3">
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                              <div>
                                <div className="font-medium">
                                  Duplicate Weather
                                </div>
                                <div className="flex items-center gap-1 mt-1">
                                  {data.duplicate_weather[
                                    loc.id.toString()
                                  ].map((duplicate, i) => (
                                    <Badge
                                      key={i}
                                      variant="destructive"
                                      className="text-xs"
                                    >
                                      {duplicate.date} (
                                      {duplicate.entries.length} entries)
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={
                                isLocPending ||
                                duplicateCleanupMutation.isPending
                              }
                              onClick={() => {
                                duplicateCleanupMutation.mutate(loc.id);
                              }}
                            >
                              {duplicateCleanupMutation.isPending &&
                              activeLocation === loc.id ? (
                                <span className="flex items-center gap-1">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Cleaning...
                                </span>
                              ) : (
                                "Clean Up"
                              )}
                            </Button>
                          </div>
                        )}
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

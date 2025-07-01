import { useEffect, useState } from "react";
import { GDDModelDashboard } from "@/types/gdd";
import { Location } from "@/types/location";
import { fetcher } from "@/lib/fetcher";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  location: Location;
}

export default function DashboardGDDModels({ location }: Props) {
  const [models, setModels] = useState<GDDModelDashboard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetcher(`/api/v1/gdd_models/location/${location.id}/dashboard`)
      .then((data) => setModels(data))
      .finally(() => setLoading(false));
  }, [location.id]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="text-muted-foreground">
        No GDD models for this location.
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">GDD Models</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {models.map((model) => {
          const percent =
            model.threshold > 0
              ? Math.min((model.current_gdd ?? 0) / model.threshold, 1)
              : 0;
          return (
            <Card
              key={model.id}
              className="p-4 flex flex-col gap-2 bg-white dark:bg-gray-900 text-black dark:text-white border border-border shadow-sm"
            >
              <div className="flex justify-between items-center">
                <span className="font-bold">{model.name}</span>
                <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded px-2 py-1">
                  Active
                </span>
              </div>
              <div>
                Base Temp: {model.base_temp}°{model.unit}
              </div>
              <div>Target: {model.threshold} GDD</div>
              <div>Current: {model.current_gdd?.toFixed(1) ?? "0"} GDD</div>
              <div>Last Reset: {model.last_reset ?? "N/A"}</div>
              {/* Progress Bar */}
              <div className="mt-4">
                <div className="w-full h-2 rounded bg-muted dark:bg-muted-foreground/20 overflow-hidden">
                  <div
                    className="h-2 rounded bg-primary transition-all"
                    style={{ width: `${percent * 100}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1 text-right">
                  {Math.round(percent * 100)}% of threshold
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

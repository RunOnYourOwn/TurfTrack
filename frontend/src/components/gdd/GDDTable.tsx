import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";

interface GDDModel {
  id: number;
  name: string;
  base_temp: number;
  unit: string;
  threshold: number;
  reset_on_threshold: boolean;
  created_at: string;
}

interface GDDTableProps {
  gddModels: GDDModel[];
  loading?: boolean;
  error?: any;
  onSelectModel: (model: GDDModel) => void;
}

export const GDDTable: React.FC<GDDTableProps> = ({
  gddModels,
  loading,
  error,
  onSelectModel,
}) => {
  if (loading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Loading GDD models...
      </div>
    );
  }
  if (error) {
    return (
      <div className="py-8 text-center text-red-500">
        Error loading GDD models: {error.message || String(error)}
      </div>
    );
  }
  if (!gddModels || gddModels.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No GDD models found for this location.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {gddModels.map((model) => (
        <Card
          key={model.id}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onSelectModel(model)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">{model.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Base Temp: {model.base_temp}°{model.unit} | Threshold:{" "}
                  {model.threshold} | Reset on Threshold:{" "}
                  {model.reset_on_threshold ? "Yes" : "No"}
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                Created: {format(new Date(model.created_at), "MMM d, yyyy")}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

import { useEffect, useState } from "react";
import WeatherSummary from "../components/WeatherSummary";
import DashboardGDDModels from "../components/dashboard/DashboardGDDModels";
import DiseasePressureSummary from "../components/dashboard/DiseasePressureSummary";
import GrowthPotentialSummary from "../components/dashboard/GrowthPotentialSummary";
import { fetcher } from "../lib/fetcher";
import { Location } from "../types/location";
import { Lawn } from "../types/lawn";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import { WeedPressureChart } from "../components/dashboard/WeedPressureChart";
import WaterManagementSummary from "../components/dashboard/WaterManagementSummary";

export default function Dashboard() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    null
  );
  const [selectedLawn, setSelectedLawn] = useState<Lawn | null>(null);
  useEffect(() => {
    fetcher("/api/v1/locations/")
      .then((data) => {
        setLocations(data);
        if (data.length > 0) setSelectedLocation(data[0]);
      })
      .catch(() => {});

    fetcher("/api/v1/lawns/")
      .then((data) => {
        if (data.length > 0) setSelectedLawn(data[0]);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="p-4 min-h-screen bg-background w-full overflow-y-auto">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="mb-4 flex items-center gap-4">
        <span className="font-medium">Location:</span>
        <Select
          value={selectedLocation?.id ? String(selectedLocation.id) : ""}
          onValueChange={(id) => {
            const loc = locations.find((l) => l.id === Number(id));
            setSelectedLocation(loc || null);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={String(loc.id)}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selectedLocation ? (
        <>
          <WeatherSummary location={selectedLocation} />
          <div className="mt-6">
            <DiseasePressureSummary location={selectedLocation} />
          </div>
          <div className="mt-6">
            <GrowthPotentialSummary location={selectedLocation} />
          </div>
          {selectedLawn && (
            <div className="mt-6">
              <WaterManagementSummary lawn={selectedLawn} />
            </div>
          )}
          <div className="mt-6">
            <WeedPressureChart locationId={selectedLocation.id} />
          </div>
          <div className="mt-8">
            <DashboardGDDModels location={selectedLocation} />
          </div>
        </>
      ) : (
        <div>Loading location...</div>
      )}
    </div>
  );
}

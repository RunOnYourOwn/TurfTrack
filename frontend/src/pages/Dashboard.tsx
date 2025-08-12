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
import { CondensedWaterManagementCard } from "../components/dashboard/WaterManagementSummary";

export default function Dashboard() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    null
  );
  const [lawns, setLawns] = useState<Lawn[]>([]);
  useEffect(() => {
    fetcher("/api/v1/locations/")
      .then((data) => {
        setLocations(data);
        if (data.length > 0) setSelectedLocation(data[0]);
      })
      .catch(() => {});

    fetcher("/api/v1/lawns/")
      .then((data) => {
        setLawns(data);
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
          {/* Water Management for all lawns at this location */}
          {lawns.filter((lawn) => lawn.location?.id === selectedLocation.id)
            .length > 0 && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-4">Water Management</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lawns
                  .filter((lawn) => lawn.location?.id === selectedLocation.id)
                  .map((lawn) => (
                    <CondensedWaterManagementCard key={lawn.id} lawn={lawn} />
                  ))}
              </div>
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

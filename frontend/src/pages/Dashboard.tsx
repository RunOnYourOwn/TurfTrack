import React, { useEffect, useState } from "react";
import WeatherSummary from "../components/WeatherSummary";
import DashboardGDDModels from "../components/dashboard/DashboardGDDModels";
import { fetcher } from "../lib/fetcher";
import { Location } from "../types/location";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";

export default function Dashboard() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    null
  );

  useEffect(() => {
    fetcher("/api/v1/locations/")
      .then((data) => {
        setLocations(data);
        if (data.length > 0) setSelectedLocation(data[0]);
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

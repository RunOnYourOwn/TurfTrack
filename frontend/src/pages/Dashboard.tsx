import WeatherSummary from "../components/WeatherSummary";

export default function Dashboard() {
  return (
    <div className="p-4 min-h-screen bg-background w-full overflow-y-auto">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <WeatherSummary />
    </div>
  );
}

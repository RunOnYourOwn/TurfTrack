import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Droplets,
  CloudRain,
  Calendar,
  Plus,
  Wifi,
  AlertTriangle,
  CheckCircle,
  Edit,
  Trash2,
  Clock,
} from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import { Lawn } from "@/types/lawn";

interface WeatherData {
  date: string;
  type: string;
  precipitation_in: number;
  et0_evapotranspiration_in: number;
  relative_humidity_mean: number | null;
}

interface WeeklyWaterData {
  week_start: string;
  week_end: string;
  et0_total: number;
  precipitation_total: number;
  irrigation_applied: number;
  water_deficit: number;
  status: "good" | "warning" | "critical" | "excellent";
  is_forecast: boolean;
}

interface IrrigationEntry {
  id?: number;
  date: string;
  amount: number;
  duration: number;
  notes?: string;
  source: "manual" | "automatic" | "scheduled";
}

export default function WaterManagement() {
  const [searchParams] = useSearchParams();
  const [lawns, setLawns] = useState<Lawn[]>([]);
  const [selectedLawn, setSelectedLawn] = useState<Lawn | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyWaterData[]>([]);
  const [irrigationEntries, setIrrigationEntries] = useState<IrrigationEntry[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [showAddIrrigation, setShowAddIrrigation] = useState(false);
  const [showEditIrrigation, setShowEditIrrigation] = useState(false);
  const [showDeleteIrrigation, setShowDeleteIrrigation] = useState(false);

  const [editingEntry, setEditingEntry] = useState<IrrigationEntry | null>(
    null
  );
  const [deletingEntry, setDeletingEntry] = useState<IrrigationEntry | null>(
    null
  );

  // Form state for adding irrigation
  const [newIrrigation, setNewIrrigation] = useState<Partial<IrrigationEntry>>({
    date: new Date().toISOString().split("T")[0],
    amount: 0,
    duration: 0,
    source: "manual",
  });

  useEffect(() => {
    // Load lawns
    fetcher<Lawn[]>("/api/v1/lawns/")
      .then((data) => {
        setLawns(data);

        // Check if there's a lawn parameter in the URL
        const lawnParam = searchParams.get("lawn");
        if (lawnParam) {
          const lawnId = parseInt(lawnParam);
          const lawn = data.find((l) => l.id === lawnId);
          if (lawn) {
            setSelectedLawn(lawn);
          }
        }

        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load lawns:", error);
        setLoading(false);
      });
  }, [searchParams]);

  useEffect(() => {
    if (selectedLawn) {
      loadWaterManagementData();
      loadIrrigationEntries();
    }
  }, [selectedLawn]);

  // No longer need to recalculate weekly data since it comes pre-calculated from the backend

  const loadWaterManagementData = async () => {
    if (!selectedLawn) return;

    try {
      // Get water management summary (includes weekly data) from the new stored summaries

      const summary = await fetcher<{
        lawn_id: number;
        current_week: WeeklyWaterData | null;
        weekly_data: WeeklyWaterData[];
        total_monthly_water: number;
      }>(`/api/v1/water-management/lawn/${selectedLawn.id}/summary`);

      // Set the weekly data directly from the stored summaries
      setWeeklyData(summary.weekly_data || []);

      // We still need weather data for the current day display and other features
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 7); // Just get last 7 days for current display
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 7);

      const weatherData = await fetcher<WeatherData[]>(
        `/api/v1/weather/location/${selectedLawn.location?.id}?start_date=${
          startDate.toISOString().split("T")[0]
        }&end_date=${endDate.toISOString().split("T")[0]}`
      );
      setWeatherData(weatherData);
    } catch (error) {
      console.error("Failed to load water management data:", error);
    }
  };

  // calculateWeeklyData function removed - now using pre-calculated data from backend

  const loadIrrigationEntries = async () => {
    if (!selectedLawn) return;

    try {
      const data = await fetcher<IrrigationEntry[]>(
        `/api/v1/water-management/lawn/${selectedLawn.id}/irrigation`
      );
      setIrrigationEntries(data);
    } catch (error) {
      console.error("Failed to load irrigation entries:", error);
      // Fallback to empty array if API fails
      setIrrigationEntries([]);
    }
  };

  const addIrrigationEntry = async () => {
    if (!selectedLawn || !newIrrigation.date || !newIrrigation.amount) return;

    try {
      await fetcher<IrrigationEntry>(
        `/api/v1/water-management/lawn/${selectedLawn.id}/irrigation`,
        {
          method: "POST",
          data: {
            lawn_id: selectedLawn.id,
            date: newIrrigation.date,
            amount: newIrrigation.amount,
            duration: newIrrigation.duration || 0,
            source: newIrrigation.source || "manual",
            notes: newIrrigation.notes,
          },
        }
      );

      // Refresh irrigation entries and water management data
      await loadIrrigationEntries();
      await loadWaterManagementData();

      setShowAddIrrigation(false);
      setNewIrrigation({
        date: new Date().toISOString().split("T")[0],
        amount: 0,
        duration: 0,
        source: "manual",
      });
    } catch (error) {
      console.error("Failed to add irrigation entry:", error);
    }
  };

  const editIrrigationEntry = async () => {
    if (!selectedLawn || !editingEntry || !editingEntry.id) return;

    try {
      // Only send fields that have values (not undefined/null)
      const updateData: any = {};
      if (editingEntry.date) updateData.date = editingEntry.date;
      if (editingEntry.amount !== undefined && editingEntry.amount >= 0)
        updateData.amount = editingEntry.amount;
      if (editingEntry.duration !== undefined && editingEntry.duration >= 0)
        updateData.duration = editingEntry.duration;
      if (editingEntry.source) updateData.source = editingEntry.source;
      if (editingEntry.notes !== undefined)
        updateData.notes = editingEntry.notes;

      try {
        await fetcher<IrrigationEntry>(
          `/api/v1/water-management/lawn/${selectedLawn.id}/irrigation/${editingEntry.id}`,
          {
            method: "PUT",
            data: updateData,
          }
        );
      } catch (error: any) {
        console.error("Full error response:", error.response?.data);
        throw error;
      }

      // Refresh irrigation entries and water management data
      await loadIrrigationEntries();
      await loadWaterManagementData();

      setShowEditIrrigation(false);
      setEditingEntry(null);
    } catch (error) {
      console.error("Failed to edit irrigation entry:", error);
    }
  };

  const deleteIrrigationEntry = async () => {
    if (!selectedLawn || !deletingEntry || !deletingEntry.id) return;

    try {
      await fetcher(
        `/api/v1/water-management/lawn/${selectedLawn.id}/irrigation/${deletingEntry.id}`,
        {
          method: "DELETE",
        }
      );

      // Refresh irrigation entries and water management data
      await loadIrrigationEntries();
      await loadWaterManagementData();

      setShowDeleteIrrigation(false);
      setDeletingEntry(null);
    } catch (error) {
      console.error("Failed to delete irrigation entry:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "excellent":
        return "bg-green-100 text-green-800 border-green-200";
      case "good":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "excellent":
        return <CheckCircle className="w-4 h-4" />;
      case "good":
        return <CheckCircle className="w-4 h-4" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4" />;
      case "critical":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const currentWeek = weeklyData.find((week) => {
    const today = new Date();
    const weekStart = new Date(week.week_start);
    const weekEnd = new Date(week.week_end);
    return today >= weekStart && today <= weekEnd;
  });

  const totalMonthlyWater = irrigationEntries.reduce(
    (sum, entry) => sum + entry.amount,
    0
  );

  if (loading) {
    return (
      <div className="p-4 min-h-screen bg-background">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading water management data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 min-h-screen bg-background w-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Water Management</h1>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddIrrigation(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Irrigation
          </Button>
        </div>
      </div>

      {/* Lawn Selector */}
      <div className="mb-6">
        <Label htmlFor="lawn" className="block mb-2">
          Lawn
        </Label>
        <Select
          value={selectedLawn?.id ? String(selectedLawn.id) : ""}
          onValueChange={(id) => {
            const lawn = lawns.find((l) => l.id === Number(id));
            setSelectedLawn(lawn || null);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select lawn" />
          </SelectTrigger>
          <SelectContent>
            {lawns.map((lawn) => (
              <SelectItem key={lawn.id} value={String(lawn.id)}>
                {lawn.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedLawn && (
        <>
          {/* Current Week Summary */}
          {currentWeek && (
            <Card className="mb-6 bg-white dark:bg-gray-900 text-black dark:text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  This Week's Water Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {currentWeek.et0_total.toFixed(2)}"
                    </div>
                    <div className="text-sm text-blue-600">Water Needed</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {currentWeek.precipitation_total.toFixed(2)}"
                    </div>
                    <div className="text-sm text-green-600">Rainfall</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {currentWeek.irrigation_applied.toFixed(2)}"
                    </div>
                    <div className="text-sm text-purple-600">
                      Irrigation Applied
                    </div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {currentWeek.water_deficit.toFixed(2)}"
                    </div>
                    <div className="text-sm text-orange-600">Deficit</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Badge className={getStatusColor(currentWeek.status)}>
                    {getStatusIcon(currentWeek.status)}
                    <span className="ml-1">
                      {currentWeek.status.charAt(0).toUpperCase() +
                        currentWeek.status.slice(1)}
                    </span>
                  </Badge>
                  <div className="text-sm text-gray-600">
                    Week of{" "}
                    {new Date(currentWeek.week_start).toLocaleDateString()}
                  </div>
                </div>

                {/* Water Balance Progress */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Water Balance</span>
                    <span>{currentWeek.water_deficit.toFixed(2)}" deficit</span>
                  </div>
                  <Progress
                    value={Math.max(
                      0,
                      Math.min(
                        100,
                        (currentWeek.water_deficit / currentWeek.et0_total) *
                          100
                      )
                    )}
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Data Message */}
          {!currentWeek && weatherData.length === 0 && (
            <Card className="mb-6 bg-white dark:bg-gray-900 text-black dark:text-white">
              <CardHeader>
                <CardTitle>No Weather Data Available</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <CloudRain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <div className="text-lg font-medium text-gray-600 mb-2">
                    No weather data found for this location
                  </div>
                  <div className="text-sm text-gray-500 mb-4">
                    Weather data may not have been fetched yet for this
                    location.
                  </div>
                  <Button variant="outline">Refresh Data</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Monthly Summary */}
          <div className="mb-6">
            <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplets className="w-5 h-5" />
                  Monthly Water Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {totalMonthlyWater.toFixed(2)}"
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  Total irrigation applied this month
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Weekly History */}
          <Card className="mb-6 bg-white dark:bg-gray-900 text-black dark:text-white">
            <CardHeader>
              <CardTitle>Weekly Water History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* All Weeks (Historical + Forecast) */}
                {weeklyData.slice(-8).map((week, index) => (
                  <div
                    key={`week-${index}`}
                    className={`flex items-center justify-between p-4 border rounded-lg ${
                      week.is_forecast
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          Week of{" "}
                          {new Date(week.week_start).toLocaleDateString()}
                          {week.is_forecast && (
                            <Badge
                              variant="outline"
                              className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                            >
                              Forecast
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {week.et0_total.toFixed(2)}" needed,{" "}
                          {week.precipitation_total.toFixed(2)}" rain
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-medium">
                          {week.irrigation_applied.toFixed(2)}" applied
                        </div>
                      </div>
                      <Badge className={getStatusColor(week.status)}>
                        {getStatusIcon(week.status)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Device Connections */}
          <Card className="mb-6 bg-white dark:bg-gray-900 text-black dark:text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="w-5 h-5" />
                Connected Devices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                <div className="text-lg font-medium text-gray-600 mb-2">
                  Device Integration Coming Soon
                </div>
                <div className="text-sm text-gray-500 mb-4">
                  We're working on integrating with sprinkler controllers, rain
                  sensors, and weather stations for automatic data collection.
                </div>
                <Badge
                  variant="outline"
                  className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700"
                >
                  <Clock className="w-3 h-3 mr-1" />
                  In Development
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Recent Irrigation Entries */}
          <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
            <CardHeader>
              <CardTitle>Recent Irrigation Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {irrigationEntries.length === 0 ? (
                <div className="text-center py-8">
                  <Droplets className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <div className="text-lg font-medium text-gray-600 mb-2">
                    No irrigation entries
                  </div>
                  <div className="text-sm text-gray-500 mb-4">
                    Add manual irrigation entries or connect devices for
                    automatic tracking.
                  </div>
                  <Button onClick={() => setShowAddIrrigation(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Entry
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {irrigationEntries.slice(0, 10).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="font-medium">
                            {new Date(entry.date).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-gray-600">
                            {entry.amount.toFixed(2)}" applied over{" "}
                            {entry.duration} minutes
                          </div>
                          {entry.notes && (
                            <div className="text-sm text-gray-500">
                              {entry.notes}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-4">
                          <div className="text-sm text-gray-600">
                            {entry.source.replace("_", " ")}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingEntry(entry);
                            setShowEditIrrigation(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingEntry(entry);
                            setShowDeleteIrrigation(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Add Irrigation Modal */}
      <Dialog open={showAddIrrigation} onOpenChange={setShowAddIrrigation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Irrigation Entry</DialogTitle>
            <DialogDescription>
              Add a new irrigation entry to track water usage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={newIrrigation.date}
                onChange={(e) =>
                  setNewIrrigation({ ...newIrrigation, date: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="amount">Amount (inches)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={newIrrigation.amount}
                onChange={(e) =>
                  setNewIrrigation({
                    ...newIrrigation,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                value={newIrrigation.duration}
                onChange={(e) =>
                  setNewIrrigation({
                    ...newIrrigation,
                    duration: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="source">Source</Label>
              <Select
                value={newIrrigation.source}
                onValueChange={(value) =>
                  setNewIrrigation({ ...newIrrigation, source: value as any })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                  <SelectItem value="automatic">Automatic</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                value={newIrrigation.notes || ""}
                onChange={(e) =>
                  setNewIrrigation({
                    ...newIrrigation,
                    notes: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addIrrigationEntry}>Add Entry</Button>
            <Button
              variant="outline"
              onClick={() => setShowAddIrrigation(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Irrigation Modal */}
      <Dialog open={showEditIrrigation} onOpenChange={setShowEditIrrigation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Irrigation Entry</DialogTitle>
            <DialogDescription>
              Update the irrigation entry details.
            </DialogDescription>
          </DialogHeader>
          {editingEntry && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editingEntry.date}
                  onChange={(e) =>
                    setEditingEntry({ ...editingEntry, date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-amount">Amount (inches)</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  value={editingEntry.amount}
                  onChange={(e) =>
                    setEditingEntry({
                      ...editingEntry,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-duration">Duration (minutes)</Label>
                <Input
                  id="edit-duration"
                  type="number"
                  value={editingEntry.duration}
                  onChange={(e) =>
                    setEditingEntry({
                      ...editingEntry,
                      duration: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-source">Source</Label>
                <Select
                  value={editingEntry.source}
                  onValueChange={(value) =>
                    setEditingEntry({ ...editingEntry, source: value as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Entry</SelectItem>
                    <SelectItem value="automatic">Automatic</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-notes">Notes (optional)</Label>
                <Input
                  id="edit-notes"
                  value={editingEntry.notes || ""}
                  onChange={(e) =>
                    setEditingEntry({
                      ...editingEntry,
                      notes: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={editIrrigationEntry}>Update Entry</Button>
            <Button
              variant="outline"
              onClick={() => setShowEditIrrigation(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Irrigation Modal */}
      <Dialog
        open={showDeleteIrrigation}
        onOpenChange={setShowDeleteIrrigation}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Irrigation Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this irrigation entry? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingEntry && (
            <div className="p-4 border rounded-lg">
              <div className="font-medium">
                {new Date(deletingEntry.date).toLocaleDateString()}
              </div>
              <div className="text-sm text-gray-600">
                {deletingEntry.amount.toFixed(2)}" applied over{" "}
                {deletingEntry.duration} minutes
              </div>
              {deletingEntry.notes && (
                <div className="text-sm text-gray-500 mt-1">
                  {deletingEntry.notes}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="destructive" onClick={deleteIrrigationEntry}>
              Delete Entry
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteIrrigation(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

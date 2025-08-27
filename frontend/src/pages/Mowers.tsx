import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "../lib/fetcher";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as React from "react";
import {
  PlusIcon,
  ClockIcon,
  WrenchIcon,
  AlertTriangleIcon,
  SettingsIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { MowerRead } from "@/types/mower";
import { mowerUtils } from "@/lib/mowerApi";
import MowerFormDialog from "@/components/mowers/MowerFormDialog";
import MowerDeleteDialog from "@/components/mowers/MowerDeleteDialog";
import MowingLogDialog from "@/components/mowers/MowingLogDialog";
import MaintenanceScheduleDialog from "@/components/mowers/MaintenanceScheduleDialog";
import MaintenanceLogDialog from "@/components/mowers/MaintenanceLogDialog";
import MowingLogEditDialog from "@/components/mowers/MowingLogEditDialog";
import MaintenanceScheduleEditDialog from "@/components/mowers/MaintenanceScheduleEditDialog";
import MaintenanceLogEditDialog from "@/components/mowers/MaintenanceLogEditDialog";

export default function MowerMaintenance() {
  const queryClient = useQueryClient();
  const { data: mowers, error } = useQuery({
    queryKey: ["mowers"],
    queryFn: () => fetcher("/api/v1/mowers/"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Selected mower state
  const [selectedMowerId, setSelectedMowerId] = React.useState<string>("");
  const selectedMower =
    mowers?.find((m: MowerRead) => m.id.toString() === selectedMowerId) || null;

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

  // Modal state
  const [open, setOpen] = React.useState(false);
  const [editMower, setEditMower] = React.useState<MowerRead | null>(null);
  const [deleteMower, setDeleteMower] = React.useState<MowerRead | null>(null);
  const [mowingLogMower, setMowingLogMower] = React.useState<MowerRead | null>(
    null
  );
  const [maintenanceScheduleMower, setMaintenanceScheduleMower] =
    React.useState<MowerRead | null>(null);
  const [maintenanceLogMower, setMaintenanceLogMower] =
    React.useState<MowerRead | null>(null);

  // Edit/Delete state for mowing logs
  const [editMowingLog, setEditMowingLog] = React.useState<any | null>(null);
  const [editMowingLogOpen, setEditMowingLogOpen] = React.useState(false);
  const [deleteMowingLog, setDeleteMowingLog] = React.useState<any | null>(
    null
  );
  const [deleteMowingLogLoading, setDeleteMowingLogLoading] =
    React.useState(false);
  const [deleteMowingLogError, setDeleteMowingLogError] = React.useState<
    string | null
  >(null);

  // Edit/Delete state for maintenance schedules
  const [editMaintenanceSchedule, setEditMaintenanceSchedule] = React.useState<
    any | null
  >(null);
  const [editMaintenanceScheduleOpen, setEditMaintenanceScheduleOpen] =
    React.useState(false);
  const [deleteMaintenanceSchedule, setDeleteMaintenanceSchedule] =
    React.useState<any | null>(null);
  const [
    deleteMaintenanceScheduleLoading,
    setDeleteMaintenanceScheduleLoading,
  ] = React.useState(false);
  const [deleteMaintenanceScheduleError, setDeleteMaintenanceScheduleError] =
    React.useState<string | null>(null);

  // Edit/Delete state for maintenance logs
  const [editMaintenanceLog, setEditMaintenanceLog] = React.useState<
    any | null
  >(null);
  const [editMaintenanceLogOpen, setEditMaintenanceLogOpen] =
    React.useState(false);
  const [deleteMaintenanceLog, setDeleteMaintenanceLog] = React.useState<
    any | null
  >(null);
  const [deleteMaintenanceLogLoading, setDeleteMaintenanceLogLoading] =
    React.useState(false);
  const [deleteMaintenanceLogError, setDeleteMaintenanceLogError] =
    React.useState<string | null>(null);

  // Pagination state
  const [mowingLogsPage, setMowingLogsPage] = React.useState(1);
  const [maintenanceSchedulesPage, setMaintenanceSchedulesPage] =
    React.useState(1);
  const [maintenanceLogsPage, setMaintenanceLogsPage] = React.useState(1);
  const itemsPerPage = 10;

  // Auto-select first mower if available
  React.useEffect(() => {
    if (mowers && mowers.length > 0 && !selectedMowerId) {
      setSelectedMowerId(mowers[0].id.toString());
    }
  }, [mowers, selectedMowerId]);

  // Reset pagination when mower changes
  React.useEffect(() => {
    setMowingLogsPage(1);
    setMaintenanceSchedulesPage(1);
    setMaintenanceLogsPage(1);
  }, [selectedMowerId]);

  const handleEdit = (mower: MowerRead) => {
    setEditMower(mower);
    setOpen(true);
  };

  const handleDelete = (mower: MowerRead) => {
    setDeleteMower(mower);
  };

  const handleLogMowing = (mower: MowerRead) => {
    setMowingLogMower(mower);
  };

  const handleScheduleMaintenance = (mower: MowerRead) => {
    setMaintenanceScheduleMower(mower);
  };

  const handleLogMaintenance = (mower: MowerRead) => {
    setMaintenanceLogMower(mower);
  };

  // Edit and Delete handlers for mowing logs
  const handleEditMowingLog = (log: any) => {
    setEditMowingLog(log);
    setEditMowingLogOpen(true);
  };

  const handleDeleteMowingLog = (log: any) => {
    setDeleteMowingLog(log);
  };

  const handleDeleteMowingLogConfirm = async () => {
    if (!deleteMowingLog) return;
    setDeleteMowingLogLoading(true);
    setDeleteMowingLogError(null);
    try {
      await fetcher(
        `/api/v1/mowers/${selectedMowerId}/mowing-logs/${deleteMowingLog.id}`,
        {
          method: "DELETE",
        }
      );
      setDeleteMowingLog(null);
      queryClient.invalidateQueries({
        queryKey: ["mowing-logs", selectedMowerId],
      });
      queryClient.invalidateQueries({ queryKey: ["mowers"] });
    } catch (err: any) {
      setDeleteMowingLogError(err.message || "Failed to delete mowing log");
    } finally {
      setDeleteMowingLogLoading(false);
    }
  };

  // Edit and Delete handlers for maintenance schedules
  const handleEditMaintenanceSchedule = (schedule: any) => {
    setEditMaintenanceSchedule(schedule);
    setEditMaintenanceScheduleOpen(true);
  };

  const handleDeleteMaintenanceSchedule = (schedule: any) => {
    setDeleteMaintenanceSchedule(schedule);
  };

  const handleDeleteMaintenanceScheduleConfirm = async () => {
    if (!deleteMaintenanceSchedule) return;
    setDeleteMaintenanceScheduleLoading(true);
    setDeleteMaintenanceScheduleError(null);
    try {
      await fetcher(
        `/api/v1/mowers/${selectedMowerId}/maintenance-schedules/${deleteMaintenanceSchedule.id}`,
        {
          method: "DELETE",
        }
      );
      setDeleteMaintenanceSchedule(null);
      queryClient.invalidateQueries({
        queryKey: ["maintenance-schedules", selectedMowerId],
      });
      queryClient.invalidateQueries({ queryKey: ["mowers"] });
    } catch (err: any) {
      setDeleteMaintenanceScheduleError(
        err.message || "Failed to delete maintenance schedule"
      );
    } finally {
      setDeleteMaintenanceScheduleLoading(false);
    }
  };

  // Edit and Delete handlers for maintenance logs
  const handleEditMaintenanceLog = (log: any) => {
    setEditMaintenanceLog(log);
    setEditMaintenanceLogOpen(true);
  };

  const handleDeleteMaintenanceLog = (log: any) => {
    setDeleteMaintenanceLog(log);
  };

  const handleDeleteMaintenanceLogConfirm = async () => {
    if (!deleteMaintenanceLog) return;
    setDeleteMaintenanceLogLoading(true);
    setDeleteMaintenanceLogError(null);
    try {
      await fetcher(
        `/api/v1/mowers/${selectedMowerId}/maintenance-logs/${deleteMaintenanceLog.id}`,
        {
          method: "DELETE",
        }
      );
      setDeleteMaintenanceLog(null);
      queryClient.invalidateQueries({
        queryKey: ["maintenance-logs", selectedMowerId],
      });
      queryClient.invalidateQueries({ queryKey: ["mowers"] });
    } catch (err: any) {
      setDeleteMaintenanceLogError(
        err.message || "Failed to delete maintenance log"
      );
    } finally {
      setDeleteMaintenanceLogLoading(false);
    }
  };

  if (error) {
    return (
      <div className="p-4 min-h-screen bg-background w-full">
        <Card className="min-h-[500px] w-full shadow-lg bg-white dark:bg-gray-900 text-black dark:text-white">
          <CardContent className="pt-6">
            <div className="py-8 text-center text-red-500">
              Error loading mowers: {(error as Error).message}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 min-h-screen bg-background w-full">
      <Card className="min-h-[500px] w-full shadow-lg bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle className="text-2xl font-bold">
            Mower Maintenance
          </CardTitle>
          <Button variant="default" size="sm" onClick={() => setOpen(true)}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Mower
          </Button>
        </CardHeader>

        {/* Mower Selection */}
        <div className="px-4 pb-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-1">
              <label
                htmlFor="mower-select"
                className="text-sm font-medium mb-2 block"
              >
                Select Mower
              </label>
              <Select
                value={selectedMowerId}
                onValueChange={setSelectedMowerId}
              >
                <SelectTrigger className="w-full md:w-80">
                  <SelectValue placeholder="Choose a mower..." />
                </SelectTrigger>
                <SelectContent>
                  {mowers?.map((mower: MowerRead) => (
                    <SelectItem key={mower.id} value={mower.id.toString()}>
                      {mower.name} - {mower.location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <CardContent className="w-full">
          {!mowers || mowers.length === 0 ? (
            <div className="flex flex-col items-center">
              <span className="text-4xl mb-2">🔧</span>
              <span className="text-muted-foreground text-lg">
                No mowers found. Add your first mower to get started.
              </span>
            </div>
          ) : !selectedMower ? (
            <div className="flex flex-col items-center">
              <span className="text-4xl mb-2">📋</span>
              <span className="text-muted-foreground text-lg">
                Select a mower to view maintenance details.
              </span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Mower Overview with Quick Actions */}
              <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        {selectedMower.name}
                      </CardTitle>
                      <p className="text-muted-foreground">
                        {selectedMower.brand} {selectedMower.model}
                        {selectedMower.year && ` (${selectedMower.year})`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(selectedMower)}
                      >
                        <SettingsIcon className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(selectedMower)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Mower Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {mowerUtils.formatHours(selectedMower.total_hours)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Total Hours
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {selectedMower.location.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Location
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {selectedMower.next_maintenance_due?.length || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Maintenance Due
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="border-t pt-4">
                    <div className="flex flex-wrap gap-3 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLogMowing(selectedMower)}
                      >
                        <ClockIcon className="mr-2 h-4 w-4" />
                        Log Mowing Session
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleScheduleMaintenance(selectedMower)}
                      >
                        <WrenchIcon className="mr-2 h-4 w-4" />
                        Schedule Maintenance
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLogMaintenance(selectedMower)}
                      >
                        <WrenchIcon className="mr-2 h-4 w-4" />
                        Log Maintenance
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Maintenance Due Alerts */}
              {selectedMower.next_maintenance_due &&
                selectedMower.next_maintenance_due.length > 0 && (
                  <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
                    <CardHeader>
                      <CardTitle className="text-lg text-red-700 dark:text-red-400 flex items-center">
                        <AlertTriangleIcon className="mr-2 h-5 w-5" />
                        Maintenance Due
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {selectedMower.next_maintenance_due.map(
                          (item: any, index: number) => {
                            const getMaintenanceTypeDisplayName = (
                              type: string
                            ) => {
                              switch (type) {
                                case "oil_change":
                                  return "Oil Change";
                                case "air_filter":
                                  return "Air Filter";
                                case "spark_plug":
                                  return "Spark Plug";
                                case "blade_sharpening":
                                  return "Blade Sharpening";
                                case "belt_replacement":
                                  return "Belt Replacement";
                                case "fuel_filter":
                                  return "Fuel Filter";
                                case "backlap":
                                  return "Backlap";
                                case "general_service":
                                  return "General Service";
                                case "custom":
                                  return item.custom_name || "Custom";
                                default:
                                  return type
                                    .replace(/_/g, " ")
                                    .replace(/\b\w/g, (l: string) =>
                                      l.toUpperCase()
                                    );
                              }
                            };

                            return (
                              <div
                                key={index}
                                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-md"
                              >
                                <div>
                                  <div className="font-medium">
                                    {item.custom_name ||
                                      getMaintenanceTypeDisplayName(
                                        item.maintenance_type
                                      )}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {item.hours_overdue} hours overdue
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

              {/* Two Column Layout for Logs and Schedules */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Mowing Logs */}
                <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Recent Mowing Logs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!mowingLogs || mowingLogs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <ClockIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        <p>No mowing logs found</p>
                        <p className="text-sm">
                          Log your first mowing session to get started
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {mowingLogs
                          .slice(
                            (mowingLogsPage - 1) * itemsPerPage,
                            mowingLogsPage * itemsPerPage
                          )
                          .map((log: any) => {
                            const lawn = lawns?.find(
                              (l: any) => l.id === log.lawn_id
                            );
                            const duration =
                              Math.floor(log.duration_minutes / 60) > 0
                                ? `${Math.floor(log.duration_minutes / 60)}h ${
                                    log.duration_minutes % 60
                                  }m`
                                : `${log.duration_minutes}m`;

                            return (
                              <div
                                key={log.id}
                                className="flex items-center justify-between p-3 bg-muted/30 rounded-md"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <ClockIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">
                                      {new Date(
                                        log.mowing_date
                                      ).toLocaleDateString()}
                                    </span>
                                    <span className="text-muted-foreground">
                                      •
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                      {lawn?.name || `Lawn ${log.lawn_id}`}
                                    </span>
                                  </div>
                                  {log.notes && (
                                    <p className="text-sm text-muted-foreground mt-1 ml-6">
                                      {log.notes}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="font-medium">{duration}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(
                                      log.created_at
                                    ).toLocaleDateString()}
                                  </div>
                                  <div className="flex gap-1 mt-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditMowingLog(log)}
                                    >
                                      <PencilIcon className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteMowingLog(log)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2Icon className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        {/* Pagination for Mowing Logs */}
                        {mowingLogs && mowingLogs.length > itemsPerPage && (
                          <div className="flex items-center justify-between pt-4 border-t">
                            <div className="text-sm text-muted-foreground">
                              Showing {(mowingLogsPage - 1) * itemsPerPage + 1}{" "}
                              to{" "}
                              {Math.min(
                                mowingLogsPage * itemsPerPage,
                                mowingLogs.length
                              )}{" "}
                              of {mowingLogs.length} logs
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setMowingLogsPage((prev) =>
                                    Math.max(1, prev - 1)
                                  )
                                }
                                disabled={mowingLogsPage === 1}
                              >
                                Previous
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setMowingLogsPage((prev) => prev + 1)
                                }
                                disabled={
                                  mowingLogsPage * itemsPerPage >=
                                  mowingLogs.length
                                }
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Right Column - Maintenance Schedules and Logs */}
                <div className="space-y-6">
                  {/* Maintenance Schedules */}
                  <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Maintenance Schedules
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!maintenanceSchedules ||
                      maintenanceSchedules.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <WrenchIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
                          <p>No maintenance schedules found</p>
                          <p className="text-sm">
                            Set up maintenance schedules to track service
                            intervals
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {maintenanceSchedules
                            .slice(
                              (maintenanceSchedulesPage - 1) * itemsPerPage,
                              maintenanceSchedulesPage * itemsPerPage
                            )
                            .map((schedule: any) => {
                              const getMaintenanceTypeDisplayName = (
                                type: string
                              ) => {
                                switch (type) {
                                  case "oil_change":
                                    return "Oil Change";
                                  case "air_filter":
                                    return "Air Filter";
                                  case "spark_plug":
                                    return "Spark Plug";
                                  case "blade_sharpening":
                                    return "Blade Sharpening";
                                  case "belt_replacement":
                                    return "Belt Replacement";
                                  case "fuel_filter":
                                    return "Fuel Filter";
                                  case "custom":
                                    return schedule.custom_name || "Custom";
                                  default:
                                    return type;
                                }
                              };

                              const nextMaintenanceHours =
                                schedule.last_maintenance_hours +
                                schedule.interval_hours;
                              const isDue =
                                selectedMower &&
                                selectedMower.total_hours >=
                                  nextMaintenanceHours;

                              return (
                                <div
                                  key={schedule.id}
                                  className={`flex items-center justify-between p-3 rounded-md ${
                                    isDue
                                      ? "bg-red-50 dark:bg-red-900/20 border border-red-200"
                                      : "bg-muted/30"
                                  }`}
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <WrenchIcon className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">
                                        {getMaintenanceTypeDisplayName(
                                          schedule.maintenance_type
                                        )}
                                      </span>
                                      {isDue && (
                                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                          Due
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1 ml-6">
                                      Every {schedule.interval_hours} hours
                                      {schedule.interval_months &&
                                        ` • ${schedule.interval_months} months`}
                                      {schedule.last_maintenance_hours > 0 && (
                                        <span>
                                          {" "}
                                          • Last:{" "}
                                          {schedule.last_maintenance_hours}h
                                        </span>
                                      )}
                                    </div>
                                    {schedule.notes && (
                                      <p className="text-sm text-muted-foreground mt-1 ml-6">
                                        {schedule.notes}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-medium">
                                      Next: {nextMaintenanceHours}h
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {isDue ? "Overdue" : "Upcoming"}
                                    </div>
                                    <div className="flex gap-1 mt-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleEditMaintenanceSchedule(
                                            schedule
                                          )
                                        }
                                      >
                                        <PencilIcon className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleDeleteMaintenanceSchedule(
                                            schedule
                                          )
                                        }
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2Icon className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                      {/* Pagination for Maintenance Schedules */}
                      {maintenanceSchedules &&
                        maintenanceSchedules.length > itemsPerPage && (
                          <div className="flex items-center justify-between pt-4 border-t">
                            <div className="text-sm text-muted-foreground">
                              Showing{" "}
                              {(maintenanceSchedulesPage - 1) * itemsPerPage +
                                1}{" "}
                              to{" "}
                              {Math.min(
                                maintenanceSchedulesPage * itemsPerPage,
                                maintenanceSchedules.length
                              )}{" "}
                              of {maintenanceSchedules.length} schedules
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setMaintenanceSchedulesPage((prev) =>
                                    Math.max(1, prev - 1)
                                  )
                                }
                                disabled={maintenanceSchedulesPage === 1}
                              >
                                Previous
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setMaintenanceSchedulesPage(
                                    (prev) => prev + 1
                                  )
                                }
                                disabled={
                                  maintenanceSchedulesPage * itemsPerPage >=
                                  maintenanceSchedules.length
                                }
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                    </CardContent>
                  </Card>

                  {/* Maintenance Logs */}
                  <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Recent Maintenance Logs
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!maintenanceLogs || maintenanceLogs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <WrenchIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
                          <p>No maintenance logs found</p>
                          <p className="text-sm">
                            Log your first maintenance session to get started
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {maintenanceLogs
                            .slice(
                              (maintenanceLogsPage - 1) * itemsPerPage,
                              maintenanceLogsPage * itemsPerPage
                            )
                            .map((log: any) => {
                              const maintenanceTypeDisplay =
                                log.custom_name ||
                                log.maintenance_type
                                  .replace(/_/g, " ")
                                  .replace(/\b\w/g, (l: string) =>
                                    l.toUpperCase()
                                  );

                              const costDisplay = log.total_cost
                                ? `$${log.total_cost.toFixed(2)}`
                                : log.labor_cost
                                ? `$${log.labor_cost.toFixed(2)} (labor)`
                                : "No cost";

                              return (
                                <div
                                  key={log.id}
                                  className="flex items-center justify-between p-3 bg-muted/30 rounded-md"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <WrenchIcon className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">
                                        {new Date(
                                          log.maintenance_date
                                        ).toLocaleDateString()}
                                      </span>
                                      <span className="text-muted-foreground">
                                        •
                                      </span>
                                      <span className="text-sm text-muted-foreground">
                                        {maintenanceTypeDisplay}
                                      </span>
                                      {log.performed_by && (
                                        <>
                                          <span className="text-muted-foreground">
                                            •
                                          </span>
                                          <span className="text-sm text-muted-foreground">
                                            by {log.performed_by}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    {log.notes && (
                                      <p className="text-sm text-muted-foreground mt-1 ml-6">
                                        {log.notes}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium">
                                      {log.hours_at_maintenance}h
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {costDisplay}
                                    </div>
                                    <div className="flex gap-1 mt-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleEditMaintenanceLog(log)
                                        }
                                      >
                                        <PencilIcon className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleDeleteMaintenanceLog(log)
                                        }
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2Icon className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          {/* Pagination for Maintenance Logs */}
                          {maintenanceLogs &&
                            maintenanceLogs.length > itemsPerPage && (
                              <div className="flex items-center justify-between pt-4 border-t">
                                <div className="text-sm text-muted-foreground">
                                  Showing{" "}
                                  {(maintenanceLogsPage - 1) * itemsPerPage + 1}{" "}
                                  to{" "}
                                  {Math.min(
                                    maintenanceLogsPage * itemsPerPage,
                                    maintenanceLogs.length
                                  )}{" "}
                                  of {maintenanceLogs.length} logs
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setMaintenanceLogsPage((prev) =>
                                        Math.max(1, prev - 1)
                                      )
                                    }
                                    disabled={maintenanceLogsPage === 1}
                                  >
                                    Previous
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setMaintenanceLogsPage((prev) => prev + 1)
                                    }
                                    disabled={
                                      maintenanceLogsPage * itemsPerPage >=
                                      maintenanceLogs.length
                                    }
                                  >
                                    Next
                                  </Button>
                                </div>
                              </div>
                            )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <MowerFormDialog
        open={open}
        onOpenChange={(open) => {
          setOpen(open);
          if (!open) setEditMower(null);
        }}
        editMower={editMower}
        onSuccess={() => {
          setOpen(false);
          setEditMower(null);
          queryClient.invalidateQueries({ queryKey: ["mowers"] });
        }}
      />

      {deleteMower && (
        <MowerDeleteDialog
          mower={deleteMower}
          open={!!deleteMower}
          onOpenChange={(open: boolean) => !open && setDeleteMower(null)}
          onSuccess={() => {
            setDeleteMower(null);
            queryClient.invalidateQueries({ queryKey: ["mowers"] });
          }}
        />
      )}

      {mowingLogMower && (
        <MowingLogDialog
          mower={mowingLogMower}
          open={!!mowingLogMower}
          onOpenChange={(open: boolean) => !open && setMowingLogMower(null)}
          onSuccess={() => {
            setMowingLogMower(null);
            queryClient.invalidateQueries({ queryKey: ["mowers"] });
            queryClient.invalidateQueries({
              queryKey: ["mowing-logs", selectedMowerId],
            });
          }}
        />
      )}

      {maintenanceScheduleMower && (
        <MaintenanceScheduleDialog
          mower={maintenanceScheduleMower}
          open={!!maintenanceScheduleMower}
          onOpenChange={(open: boolean) =>
            !open && setMaintenanceScheduleMower(null)
          }
          onSuccess={() => {
            setMaintenanceScheduleMower(null);
            queryClient.invalidateQueries({ queryKey: ["mowers"] });
            queryClient.invalidateQueries({
              queryKey: ["maintenance-schedules", selectedMowerId],
            });
          }}
        />
      )}

      {maintenanceLogMower && (
        <MaintenanceLogDialog
          mowerId={maintenanceLogMower.id}
          mowerTotalHours={maintenanceLogMower.total_hours}
          open={!!maintenanceLogMower}
          onOpenChange={(open: boolean) =>
            !open && setMaintenanceLogMower(null)
          }
          onSuccess={() => {
            setMaintenanceLogMower(null);
            queryClient.invalidateQueries({ queryKey: ["mowers"] });
            queryClient.invalidateQueries({
              queryKey: ["maintenance-schedules", selectedMowerId],
            });
            queryClient.invalidateQueries({
              queryKey: ["maintenance-logs", selectedMowerId],
            });
          }}
        />
      )}

      {/* Edit Dialogs */}
      <MowingLogEditDialog
        open={editMowingLogOpen}
        onOpenChange={setEditMowingLogOpen}
        mowingLog={editMowingLog}
        mowerId={selectedMowerId}
        onSuccess={() => {
          setEditMowingLogOpen(false);
          setEditMowingLog(null);
          queryClient.invalidateQueries({
            queryKey: ["mowing-logs", selectedMowerId],
          });
          queryClient.invalidateQueries({ queryKey: ["mowers"] });
        }}
      />

      <MaintenanceScheduleEditDialog
        open={editMaintenanceScheduleOpen}
        onOpenChange={setEditMaintenanceScheduleOpen}
        maintenanceSchedule={editMaintenanceSchedule}
        mowerId={selectedMowerId}
        onSuccess={() => {
          setEditMaintenanceScheduleOpen(false);
          setEditMaintenanceSchedule(null);
          queryClient.invalidateQueries({
            queryKey: ["maintenance-schedules", selectedMowerId],
          });
          queryClient.invalidateQueries({ queryKey: ["mowers"] });
        }}
      />

      <MaintenanceLogEditDialog
        open={editMaintenanceLogOpen}
        onOpenChange={setEditMaintenanceLogOpen}
        maintenanceLog={editMaintenanceLog}
        mowerId={selectedMowerId}
        mowerTotalHours={selectedMower?.total_hours || 0}
        onSuccess={() => {
          setEditMaintenanceLogOpen(false);
          setEditMaintenanceLog(null);
          queryClient.invalidateQueries({
            queryKey: ["maintenance-logs", selectedMowerId],
          });
          queryClient.invalidateQueries({
            queryKey: ["maintenance-schedules", selectedMowerId],
          });
          queryClient.invalidateQueries({ queryKey: ["mowers"] });
        }}
      />

      {/* Delete Confirmation Dialogs */}
      {deleteMowingLog && (
        <AlertDialog
          open={!!deleteMowingLog}
          onOpenChange={(open) => {
            if (!open) setDeleteMowingLog(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Mowing Log</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this mowing log? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteMowingLogError && (
              <div className="text-red-500 text-sm mb-2">
                {deleteMowingLogError}
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={deleteMowingLogLoading}
                onClick={() => setDeleteMowingLog(null)}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteMowingLogLoading}
                onClick={handleDeleteMowingLogConfirm}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {deleteMowingLogLoading ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {deleteMaintenanceSchedule && (
        <AlertDialog
          open={!!deleteMaintenanceSchedule}
          onOpenChange={(open) => {
            if (!open) setDeleteMaintenanceSchedule(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Maintenance Schedule</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this maintenance schedule? This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteMaintenanceScheduleError && (
              <div className="text-red-500 text-sm mb-2">
                {deleteMaintenanceScheduleError}
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={deleteMaintenanceScheduleLoading}
                onClick={() => setDeleteMaintenanceSchedule(null)}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteMaintenanceScheduleLoading}
                onClick={handleDeleteMaintenanceScheduleConfirm}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {deleteMaintenanceScheduleLoading ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {deleteMaintenanceLog && (
        <AlertDialog
          open={!!deleteMaintenanceLog}
          onOpenChange={(open) => {
            if (!open) setDeleteMaintenanceLog(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Maintenance Log</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this maintenance log? This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteMaintenanceLogError && (
              <div className="text-red-500 text-sm mb-2">
                {deleteMaintenanceLogError}
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={deleteMaintenanceLogLoading}
                onClick={() => setDeleteMaintenanceLog(null)}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteMaintenanceLogLoading}
                onClick={handleDeleteMaintenanceLogConfirm}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {deleteMaintenanceLogLoading ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

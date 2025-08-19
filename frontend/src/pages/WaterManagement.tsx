import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { fetcher } from "@/lib/fetcher";
import { Lawn } from "@/types/lawn";
import {
  WaterManagementHeader,
  WaterManagementOverview,
  WeeklyWaterHistory,
  IrrigationEntriesSection,
  ConnectedDevicesSection,
  IrrigationEntryDialog,
  IrrigationEntryDeleteDialog,
  DailyWaterBreakdown,
} from "@/components/water-management";
import { WeeklyWaterSummary, IrrigationEntry } from "@/types/water-management";

export default function WaterManagement() {
  const [searchParams] = useSearchParams();
  const [lawns, setLawns] = useState<Lawn[]>([]);
  const [selectedLawn, setSelectedLawn] = useState<Lawn | null>(null);

  const [weeklyData, setWeeklyData] = useState<WeeklyWaterSummary[]>([]);
  const [irrigationEntries, setIrrigationEntries] = useState<IrrigationEntry[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [showAddIrrigation, setShowAddIrrigation] = useState(false);
  const [showEditIrrigation, setShowEditIrrigation] = useState(false);
  const [showDeleteIrrigation, setShowDeleteIrrigation] = useState(false);
  const [showDailyBreakdown, setShowDailyBreakdown] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<WeeklyWaterSummary | null>(
    null
  );

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
      // Add cache-busting parameter to ensure fresh data
      const timestamp = new Date().getTime();
      const summary = await fetcher<{
        lawn_id: number;
        current_week: WeeklyWaterSummary | null;
        weekly_data: WeeklyWaterSummary[];
        total_monthly_water: number;
      }>(
        `/api/v1/water-management/lawn/${selectedLawn.id}/summary?_t=${timestamp}`
      );

      // Set the weekly data directly from the stored summaries
      setWeeklyData(summary.weekly_data || []);
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

  const handleWeekClick = (week: WeeklyWaterSummary) => {
    setSelectedWeek(week);
    setShowDailyBreakdown(true);
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
      <WaterManagementHeader
        lawns={lawns}
        selectedLawn={selectedLawn}
        onLawnChange={setSelectedLawn}
        onAddIrrigation={() => setShowAddIrrigation(true)}
      />

      {selectedLawn && (
        <>
          <WaterManagementOverview
            currentWeek={currentWeek || null}
            totalMonthlyWater={totalMonthlyWater}
          />

          <div className="mt-6">
            <WeeklyWaterHistory
              weeklyData={weeklyData}
              onWeekClick={handleWeekClick}
            />
          </div>

          <div className="mt-6">
            <ConnectedDevicesSection />
          </div>

          <div className="mt-6">
            <IrrigationEntriesSection
              irrigationEntries={irrigationEntries}
              onAddEntry={() => setShowAddIrrigation(true)}
              onEditEntry={(entry) => {
                setEditingEntry(entry);
                setShowEditIrrigation(true);
              }}
              onDeleteEntry={(entry) => {
                setDeletingEntry(entry);
                setShowDeleteIrrigation(true);
              }}
            />
          </div>
        </>
      )}

      {/* Add Irrigation Dialog */}
      <IrrigationEntryDialog
        open={showAddIrrigation}
        onOpenChange={setShowAddIrrigation}
        mode="add"
        form={newIrrigation}
        submitting={false}
        onInputChange={(e) =>
          setNewIrrigation({
            ...newIrrigation,
            [e.target.name]: e.target.value,
          })
        }
        onSourceChange={(value) =>
          setNewIrrigation({ ...newIrrigation, source: value as any })
        }
        onSubmit={(e) => {
          e.preventDefault();
          addIrrigationEntry();
        }}
        onCancel={() => setShowAddIrrigation(false)}
      />

      {/* Edit Irrigation Dialog */}
      <IrrigationEntryDialog
        open={showEditIrrigation}
        onOpenChange={setShowEditIrrigation}
        mode="edit"
        form={editingEntry || {}}
        submitting={false}
        onInputChange={(e) =>
          setEditingEntry({
            ...editingEntry!,
            [e.target.name]: e.target.value,
          })
        }
        onSourceChange={(value) =>
          setEditingEntry({ ...editingEntry!, source: value as any })
        }
        onSubmit={(e) => {
          e.preventDefault();
          editIrrigationEntry();
        }}
        onCancel={() => setShowEditIrrigation(false)}
      />

      {/* Delete Irrigation Dialog */}
      <IrrigationEntryDeleteDialog
        open={showDeleteIrrigation}
        onOpenChange={setShowDeleteIrrigation}
        entry={deletingEntry}
        onConfirm={deleteIrrigationEntry}
        onCancel={() => setShowDeleteIrrigation(false)}
        deleting={false}
      />

      {/* Daily Water Breakdown Dialog */}
      <DailyWaterBreakdown
        open={showDailyBreakdown}
        onOpenChange={setShowDailyBreakdown}
        week={selectedWeek}
        lawnId={selectedLawn?.id || 0}
      />
    </div>
  );
}

import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Droplets, Edit, Trash2, Plus } from "lucide-react";
import { IrrigationEntry } from "../../types/water-management";

interface IrrigationEntriesSectionProps {
  irrigationEntries: IrrigationEntry[];
  onAddEntry: () => void;
  onEditEntry: (entry: IrrigationEntry) => void;
  onDeleteEntry: (entry: IrrigationEntry) => void;
}

export function IrrigationEntriesSection({
  irrigationEntries,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
}: IrrigationEntriesSectionProps) {
  if (irrigationEntries.length === 0) {
    return (
      <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5" />
            Recent Irrigation Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Droplets className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No irrigation entries
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Add manual irrigation entries or connect devices for automatic
              tracking.
            </p>
            <Button onClick={onAddEntry}>
              <Plus className="mr-2 h-4 w-4" />
              Add Entry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5" />
            Recent Irrigation Entries
          </CardTitle>
          <Button onClick={onAddEntry} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Entry
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {irrigationEntries.slice(0, 5).map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {new Date(entry.date).toLocaleDateString()}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {entry.amount.toFixed(2)}" • {entry.duration} min
                  </span>
                  <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    {entry.source}
                  </span>
                </div>
                {entry.notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {entry.notes}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditEntry(entry)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDeleteEntry(entry)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

import { Button } from "../ui/button";
import { Plus } from "lucide-react";
import { Lawn } from "../../types/lawn";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface WaterManagementHeaderProps {
  lawns: Lawn[];
  selectedLawn: Lawn | null;
  onLawnChange: (lawn: Lawn | null) => void;
  onAddIrrigation: () => void;
}

export function WaterManagementHeader({
  lawns,
  selectedLawn,
  onLawnChange,
  onAddIrrigation,
}: WaterManagementHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Water Management</h1>
        <div className="flex items-center gap-2">
          <span className="font-medium">Lawn:</span>
          <Select
            value={selectedLawn?.id ? String(selectedLawn.id) : ""}
            onValueChange={(id) => {
              const lawn = lawns.find((l) => l.id === Number(id));
              onLawnChange(lawn || null);
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
      </div>
      <Button onClick={onAddIrrigation}>
        <Plus className="mr-2 h-4 w-4" />
        Add Irrigation
      </Button>
    </div>
  );
}

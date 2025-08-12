import { Progress } from "../ui/progress";

interface WaterBalanceProgressProps {
  deficit: number;
  className?: string;
}

export function WaterBalanceProgress({
  deficit,
  className = "",
}: WaterBalanceProgressProps) {
  // Calculate progress value based on deficit
  // Positive deficit (water needed) = lower progress
  // Negative deficit (excess water) = higher progress
  const progressValue = Math.max(0, Math.min(100, (1 - deficit / 2) * 100));

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Progress value={progressValue} className="flex-1" />
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {deficit.toFixed(2)} deficit
      </span>
    </div>
  );
}

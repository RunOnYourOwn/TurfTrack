interface WaterStatusCardProps {
  value: number;
  label: string;
  color: "blue" | "green" | "purple" | "orange";
  className?: string;
}

export function WaterStatusCard({
  value,
  label,
  color,
  className = "",
}: WaterStatusCardProps) {
  const getColorClasses = (color: string) => {
    switch (color) {
      case "blue":
        return "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400";
      case "green":
        return "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400";
      case "purple":
        return "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400";
      case "orange":
        return "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400";
      default:
        return "bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <div className={`p-3 rounded-lg ${getColorClasses(color)} ${className}`}>
      <div className="text-lg font-semibold">{value.toFixed(2)}"</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}

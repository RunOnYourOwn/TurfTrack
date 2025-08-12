interface WaterRecommendationProps {
  deficit: number;
  className?: string;
}

export function WaterRecommendation({
  deficit,
  className = "",
}: WaterRecommendationProps) {
  const getRecommendation = (deficit: number) => {
    if (deficit <= 0) return "No irrigation needed";
    if (deficit <= 0.5) return "Light irrigation recommended";
    if (deficit <= 1.0) return "Moderate irrigation needed";
    return "Heavy irrigation required";
  };

  return (
    <div className={className}>
      <h4 className="text-sm font-medium mb-1">Recommendation</h4>
      <p className="text-gray-600 dark:text-gray-400 text-sm">
        {getRecommendation(deficit)}
      </p>
    </div>
  );
}

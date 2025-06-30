import { ResponsiveLine } from "@nivo/line";

// Custom slice tooltip for Nivo chart (single series, labeled)
const CustomSliceTooltip = ({ slice }: { slice: any }) => {
  const date = slice.points[0].data.xFormatted || slice.points[0].data.x;
  const value = Number(
    slice.points[0].data.yFormatted || slice.points[0].data.y
  ).toFixed(2);
  return (
    <div
      style={{
        background: "#222",
        color: "#fff",
        padding: "8px 12px",
        borderRadius: 6,
        fontSize: 13,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        maxWidth: 220,
        whiteSpace: "nowrap",
      }}
    >
      <div>
        <b>Date:</b> {date}
      </div>
      <div>
        <b>Cumulative GDD:</b> {value}
      </div>
    </div>
  );
};

interface GDDChartProps {
  chartData: any[];
  model: any;
  selectedRun: number | null;
  onManualReset: () => void;
}

export function GDDChart({
  chartData,
  model,
  selectedRun,
  onManualReset,
}: GDDChartProps) {
  // Responsive Nivo chart margins and font size
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const chartMargin = isMobile
    ? { top: 20, right: 10, bottom: 60, left: 40 }
    : { top: 20, right: 30, bottom: 110, left: 60 };
  const axisFontSize = isMobile ? 10 : 13;

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between p-4">
        <div className="text-sm text-muted-foreground">
          {selectedRun
            ? `Showing Run ${selectedRun}`
            : "Select a run from history below"}
        </div>
        <button
          onClick={onManualReset}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
        >
          Manual Reset
        </button>
      </div>
      <div className="h-[300px] p-4 pb-10">
        <div className="w-full" style={{ height: 300 }}>
          <ResponsiveLine
            data={chartData}
            xScale={{ type: "point" }}
            yScale={{
              type: "linear",
              min: 0,
              max:
                Math.max(
                  typeof model?.threshold === "number" ? model.threshold : 0,
                  ...(chartData[0]?.data || []).map((d: any) => d.y)
                ) * 1.1,
            }}
            axisBottom={{
              tickRotation: -45,
              legend: "Date",
              legendOffset: 70,
              legendPosition: "middle",
              tickValues: "every 2nd",
            }}
            axisLeft={{
              legend: "Cumulative GDD",
              legendOffset: -40,
              legendPosition: "middle",
            }}
            margin={chartMargin}
            pointSize={8}
            enableSlices="x"
            theme={{
              axis: {
                ticks: {
                  text: {
                    fill: "var(--nivo-axis-text, #222)",
                    transition: "fill 0.2s",
                    fontSize: axisFontSize,
                  },
                },
                legend: {
                  text: {
                    fill: "var(--nivo-axis-text, #222)",
                    transition: "fill 0.2s",
                    fontSize: axisFontSize,
                  },
                },
              },
              tooltip: {
                container: { background: "#222", color: "#fff" },
              },
              grid: {
                line: { stroke: "#444", strokeDasharray: "3 3" },
              },
            }}
            colors={{ scheme: "category10" }}
            sliceTooltip={CustomSliceTooltip}
            markers={
              typeof model?.threshold === "number"
                ? [
                    {
                      axis: "y",
                      value: model.threshold,
                      lineStyle: {
                        stroke: "#ef4444",
                        strokeWidth: 2,
                        strokeDasharray: "6 6",
                      },
                      legend: `Threshold (${model.threshold})`,
                      legendPosition: "top",
                      textStyle: { fill: "#ef4444", fontSize: 12 },
                    },
                  ]
                : []
            }
          />
        </div>
      </div>
    </div>
  );
}

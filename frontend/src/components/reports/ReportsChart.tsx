import { ResponsiveLine } from "@nivo/line";
import { nivoTheme, nivoColors } from "@/lib/nivoTheme";

interface ReportsChartProps {
  data: any[];
  isMobile: boolean;
}

export function ReportsChart({ data, isMobile }: ReportsChartProps) {
  // Responsive Nivo chart margins, font size, tick rotation, and legend
  const chartMargin = isMobile
    ? { top: 16, right: 10, bottom: 80, left: 40 }
    : { top: 16, right: 24, bottom: 120, left: 60 };
  const axisFontSize = isMobile ? 10 : 13;
  const tickRotation = isMobile ? -30 : -45;
  const legendAnchor = isMobile ? "bottom" : "bottom";
  const legendDirection = isMobile ? "row" : "row";
  const legendTranslateY = isMobile ? 70 : 100;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-2">Cumulative Over Time</h2>
      <div
        className="bg-background dark:bg-gray-900 rounded shadow p-4 w-full"
        style={{ height: 400 }}
      >
        <ResponsiveLine
          data={data}
          xScale={{ type: "point" }}
          yScale={{
            type: "linear",
            min: "auto",
            max: "auto",
            stacked: false,
          }}
          axisBottom={{
            tickRotation,
          }}
          axisLeft={{
            legend: "Cumulative",
            legendOffset: -40,
            legendPosition: "middle",
          }}
          margin={chartMargin}
          pointSize={8}
          useMesh={true}
          theme={{
            ...nivoTheme,
            axis: {
              ...nivoTheme.axis,
              ticks: {
                ...nivoTheme.axis.ticks,
                text: {
                  ...nivoTheme.axis.ticks.text,
                  fontSize: axisFontSize,
                },
              },
              legend: {
                ...nivoTheme.axis.legend,
                text: {
                  ...nivoTheme.axis.legend.text,
                  fontSize: axisFontSize,
                },
              },
            },
            legends: {
              text: {
                fill: "var(--nivo-axis-text, #222)",
              },
            },
          }}
          colors={{ scheme: "category10" }}
          enableSlices="x"
          tooltip={() => null}
          sliceTooltip={() => null}
          legends={
            isMobile
              ? []
              : [
                  {
                    anchor: legendAnchor,
                    direction: legendDirection,
                    justify: false,
                    translateX: 0,
                    translateY: legendTranslateY,
                    itemsSpacing: 8,
                    itemDirection: "left-to-right",
                    itemWidth: 80,
                    itemHeight: 20,
                    itemOpacity: 0.75,
                    symbolSize: 12,
                    symbolShape: "circle",
                    effects: [
                      {
                        on: "hover",
                        style: {
                          itemBackground: "rgba(0, 0, 0, .03)",
                          itemOpacity: 1,
                        },
                      },
                    ],
                  },
                ]
          }
        />
      </div>
      {/* Custom HTML legend for mobile (outside chart container) */}
      {isMobile && (
        <div
          className="flex overflow-x-auto gap-4 py-2 w-full mt-2"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {data.map((series, i) => (
            <div
              key={series.id}
              className="flex items-center min-w-[70px] flex-shrink-0"
            >
              <span
                className="inline-block rounded-full mr-2"
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: nivoColors[i % nivoColors.length],
                }}
              />
              <span
                style={{
                  color: "var(--nivo-axis-text, #222)",
                  fontSize: 13,
                }}
              >
                {series.id}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

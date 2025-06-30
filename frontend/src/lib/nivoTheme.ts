// Nivo color scheme (category10)
export const nivoColors = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
];

// Dynamic Nivo theme for dark/light mode
export const nivoTheme = {
  axis: {
    ticks: {
      text: {
        fill: "var(--nivo-axis-text, #222)",
        transition: "fill 0.2s",
      },
    },
    legend: {
      text: {
        fill: "var(--nivo-axis-text, #222)",
        transition: "fill 0.2s",
      },
    },
  },
  tooltip: {
    container: { background: "#222", color: "#fff" },
  },
  grid: {
    line: { stroke: "#444", strokeDasharray: "3 3" },
  },
};

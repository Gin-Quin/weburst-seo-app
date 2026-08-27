export const chartColors = [
	"var(--color-chart-red)",
	"var(--color-chart-orange)",
	"var(--color-chart-amber)",
	"var(--color-chart-yellow)",
	"var(--color-chart-lime)",
	"var(--color-chart-green)",
	"var(--color-chart-cyan)",
	"var(--color-chart-blue)",
	"var(--color-chart-indigo)",
	"var(--color-chart-magenta)",
] as const;

export function getChartColor(index: number): string {
	return chartColors[index % chartColors.length]!;
}

import type { ClusterBarChartData } from "./getClusterBarChartData";

/** Domain shares are relative to their own cluster, not to the largest cluster. */
export function getClusterBarHeights(
	item: Pick<ClusterBarChartData, "totalVolume" | "clientShare" | "comparisonShare">,
	volumeMax: number,
	plotHeight: number,
) {
	const cluster = volumeMax > 0 ? (item.totalVolume / volumeMax) * plotHeight : 0;
	const heightForShare = (share: number) => cluster * Math.min(100, Math.max(0, share)) / 100;
	return {
		cluster,
		client: heightForShare(item.clientShare),
		comparison: heightForShare(item.comparisonShare),
	};
}

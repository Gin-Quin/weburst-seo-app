export const POSITION_WEIGHTS_PERCENT = [20, 10, 8, 7, 6, 5, 4, 3, 2, 1] as const;

export function getWeightedVolume(volume: number, position: number): number {
	const ratio = (POSITION_WEIGHTS_PERCENT[position - 1] ?? 0) / 100;
	return volume * ratio;
}

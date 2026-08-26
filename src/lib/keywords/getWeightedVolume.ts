export const POSITION_WEIGHTS_PERCENT = [
	39.8, 18.7, 10.2, 7.2, 5.1, 4.4, 3.0, 2.1, 1.9, 1.6,
] as const;

export function getWeightedVolume(volume: number, position: number): number {
	const ratio = (POSITION_WEIGHTS_PERCENT[position - 1] ?? 0.15) / 100;
	return volume * ratio;
}

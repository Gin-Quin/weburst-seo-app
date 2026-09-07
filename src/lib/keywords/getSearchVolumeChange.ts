export function getSearchVolumeChange(current: number, previous: number) {
	return {
		absolute: current - previous,
		relative: previous > 0 ? (current - previous) / previous : undefined,
	};
}

const LABEL_BREAK_CHARACTERS = /[\s./_-]/;

export function wrapSvgLabel(
	label: string,
	maxCharacters = 14,
	maxLines = 2,
): string[] {
	const lines: string[] = [];
	let remaining = label.trim();

	while (remaining && lines.length < maxLines) {
		const isLastLine = lines.length === maxLines - 1;
		if (remaining.length <= maxCharacters) {
			lines.push(remaining);
			break;
		}

		if (isLastLine) {
			lines.push(`${remaining.slice(0, maxCharacters - 1).trimEnd()}…`);
			break;
		}

		const minimumBreakIndex = Math.ceil(maxCharacters * 0.5);
		let breakIndex = maxCharacters;
		for (let index = maxCharacters - 1; index >= minimumBreakIndex; index--) {
			if (LABEL_BREAK_CHARACTERS.test(remaining[index] ?? "")) {
				breakIndex = index + 1;
				break;
			}
		}

		lines.push(remaining.slice(0, breakIndex).trimEnd());
		remaining = remaining.slice(breakIndex).trimStart();
	}

	return lines;
}

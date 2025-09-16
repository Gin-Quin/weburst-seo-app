export function elementHasParent<ElementOrNode extends Element | Node>(
	element: ElementOrNode | null | undefined,
	match: (element: Element) => boolean,
): Element | undefined {
	let parent = element?.parentElement;
	while (parent) {
		if (match(parent)) return parent;
		parent = parent?.parentElement;
	}
}

import type { Attrs, NodeType } from "prosemirror-model";
import type { Command } from "prosemirror-state";
import { wrapInList } from "prosemirror-schema-list";

/**
 * Wrap a regular selection in a list, or change the type of the list that
 * already contains the selection.
 */
export function setListType(
	listType: NodeType,
	listItemType: NodeType,
	attrs: Attrs | null = null,
): Command {
	return (state, dispatch) => {
		const { $from, $to } = state.selection;

		for (let depth = $from.depth; depth > 0; depth -= 1) {
			const node = $from.node(depth);
			const selectionEndsInNode = $to.pos <= $from.end(depth);
			const isList =
				node.firstChild?.type === listItemType && node.type.compatibleContent(listType);

			if (!selectionEndsInNode || !isList) continue;
			if (node.type === listType) return false;

			if (dispatch) {
				dispatch(state.tr.setNodeMarkup($from.before(depth), listType, attrs).scrollIntoView());
			}
			return true;
		}

		return wrapInList(listType, attrs)(state, dispatch);
	};
}

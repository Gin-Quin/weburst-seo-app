import sanitizeHtml from "sanitize-html";

const allowedTags = [
	"p",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"blockquote",
	"pre",
	"code",
	"strong",
	"em",
	"u",
	"s",
	"br",
	"hr",
	"ul",
	"ol",
	"li",
	"a",
	"img",
	"table",
	"thead",
	"tbody",
	"tfoot",
	"tr",
	"th",
	"td",
];

export function sanitizeContentHtml(html: string, options: { baseUrl?: string } = {}): string {
	return sanitizeHtml(convertAsciiTablesInHtml(html), {
		allowedTags,
		allowedAttributes: {
			a: ["href", "target", "rel"],
			img: ["src", "alt", "title"],
			th: ["colspan", "rowspan", "data-colwidth"],
			td: ["colspan", "rowspan", "data-colwidth"],
		},
		allowedSchemes: ["http", "https", "mailto"],
		transformTags: {
			a: (_tagName, attributes) => ({
				tagName: "a",
				attribs: {
					...attributes,
					href: absoluteUrl(attributes.href, options.baseUrl),
					rel: "noopener noreferrer",
				},
			}),
			img: (_tagName, attributes) => ({
				tagName: "img",
				attribs: {
					...attributes,
					src: absoluteUrl(attributes.src, options.baseUrl),
				},
			}),
		},
	});
}

function absoluteUrl(value: string | undefined, baseUrl: string | undefined): string {
	if (!value || !baseUrl) return value ?? "";
	try {
		return new URL(value, baseUrl).toString();
	} catch {
		return value;
	}
}

export function convertAsciiTablesInHtml(html: string): string {
	return html.replace(
		/<pre(?:\s[^>]*)?>\s*<code(?:\s[^>]*)?>([\s\S]*?)<\/code>\s*<\/pre>/gi,
		(original, encodedCode: string) =>
			asciiTableToHtml(decodeHtmlEntities(encodedCode)) ?? original,
	);
}

export function contentHtmlToText(html: string): string {
	const withLineBreaks = html.replace(/<\/(?:p|h[1-6]|li|blockquote|pre)>/gi, "$&\n");
	return sanitizeHtml(withLineBreaks, {
		allowedTags: [],
		allowedAttributes: {},
		textFilter: (text) => text,
	})
		.replace(/\u00a0/g, " ")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export function createInitialArticleHtml(title: string): string {
	return `<h1>${escapeHtml(title)}</h1><p></p>`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function asciiTableToHtml(value: string): string | undefined {
	if (!/^\s*\+-{3,}/m.test(value)) return undefined;

	const rows = value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.startsWith("|") && line.endsWith("|"))
		.map((line) =>
			line
				.slice(1, -1)
				.split("|")
				.map((cell) => cell.trim()),
		);
	const headerIndex = rows.findIndex((row) => row.length > 1);
	if (headerIndex < 0) return undefined;

	const columnCount = rows[headerIndex]!.length;
	const bodyRows = rows.slice(headerIndex + 1).filter((row) => row.length === columnCount);
	if (bodyRows.length === 0) return undefined;

	const title = rows.slice(0, headerIndex).findLast((row) => row.length === 1)?.[0];
	const header = rows[headerIndex]!;
	const titleHtml = title ? `<p><strong>${escapeHtml(title)}</strong></p>` : "";
	const headerHtml = `<thead><tr>${header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead>`;
	const bodyHtml = `<tbody>${bodyRows
		.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
		.join("")}</tbody>`;

	return `${titleHtml}<table>${headerHtml}${bodyHtml}</table>`;
}

function decodeHtmlEntities(value: string): string {
	return value.replace(
		/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|#39);/gi,
		(entity, reference: string) => {
			if (reference[0] === "#") {
				const hexadecimal = reference[1]?.toLowerCase() === "x";
				const codePoint = Number.parseInt(
					reference.slice(hexadecimal ? 2 : 1),
					hexadecimal ? 16 : 10,
				);
				return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
			}
			return (
				{ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[reference.toLowerCase()] ?? entity
			);
		},
	);
}

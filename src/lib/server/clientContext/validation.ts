export const CLIENT_CONTEXT_EXTENSIONS = ["txt", "pdf", "md"] as const;
export const CLIENT_CONTEXT_ACCEPT = CLIENT_CONTEXT_EXTENSIONS.map(
	(extension) => `.${extension}`,
).join(",");
export const MAX_CLIENT_CONTEXT_LENGTH = 50_000;
export const MAX_CLIENT_CONTEXT_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_CLIENT_CONTEXT_TOTAL_UPLOAD_SIZE = 25 * 1024 * 1024;
export const MAX_CLIENT_CONTEXT_FILES = 20;

export type ClientContextExtension = (typeof CLIENT_CONTEXT_EXTENSIONS)[number];

export type ContextFileCandidate = {
	name: string;
	type: string;
	size: number;
};

const MIME_TYPES: Record<ClientContextExtension, readonly string[]> = {
	txt: ["", "text/plain"],
	md: ["", "text/markdown", "text/plain", "text/x-markdown"],
	pdf: ["", "application/pdf"],
};

export function getContextFileExtension(name: string): ClientContextExtension | null {
	const extension = name.split(".").pop()?.toLowerCase();
	return CLIENT_CONTEXT_EXTENSIONS.includes(extension as ClientContextExtension)
		? (extension as ClientContextExtension)
		: null;
}

export function validateContextFile(file: ContextFileCandidate): ClientContextExtension {
	if (file.name.length > 255) throw new Error("Le nom du fichier est trop long.");
	if (
		[...file.name].some((character) => {
			const code = character.charCodeAt(0);
			return code <= 0x1f || code === 0x7f;
		})
	) {
		throw new Error("Le nom du fichier contient des caractères invalides.");
	}
	const extension = getContextFileExtension(file.name);
	if (!extension) {
		throw new Error("Seuls les fichiers .txt, .pdf et .md sont acceptés.");
	}
	if (file.size <= 0) throw new Error(`Le fichier « ${file.name} » est vide.`);
	if (file.size > MAX_CLIENT_CONTEXT_FILE_SIZE) {
		throw new Error(`Le fichier « ${file.name} » dépasse la limite de 10 Mo.`);
	}
	if (!MIME_TYPES[extension].includes(file.type.toLowerCase())) {
		throw new Error(`Le type du fichier « ${file.name} » ne correspond pas à son extension.`);
	}
	return extension;
}

export function validateContextFileContents(
	extension: ClientContextExtension,
	data: Uint8Array,
): void {
	if (extension === "pdf") {
		const header = new TextDecoder("ascii").decode(data.subarray(0, 1024));
		if (!header.includes("%PDF-")) throw new Error("Le fichier PDF est invalide.");
		return;
	}

	decodeContextTextFile(data);
}

export function decodeContextTextFile(data: Uint8Array): string {
	if (data.includes(0)) throw new Error("Le fichier texte contient des données binaires.");
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(data).replace(/^\uFEFF/, "");
	} catch {
		throw new Error("Le fichier texte doit être encodé en UTF-8.");
	}
}

export function validateContextUpload(files: ContextFileCandidate[]): void {
	if (files.length > MAX_CLIENT_CONTEXT_FILES) {
		throw new Error(`Vous pouvez joindre au maximum ${MAX_CLIENT_CONTEXT_FILES} fichiers.`);
	}
	for (const file of files) validateContextFile(file);
	if (files.reduce((total, file) => total + file.size, 0) > MAX_CLIENT_CONTEXT_TOTAL_UPLOAD_SIZE) {
		throw new Error("La taille totale des nouveaux fichiers dépasse 25 Mo.");
	}
}

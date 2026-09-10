import { getLocale } from "$lib/i18n/locale.svelte";
import { toast } from "svelte-sonner";
import type { LoadFailure } from "./loadWithDiagnostics";

export function reportLoadError(
	failure: LoadFailure,
	context: { userId?: string; projectId?: string; pathname: string },
) {
	console.error("[client-load-error]", {
		...failure,
		...context,
		timestamp: new Date().toISOString(),
		online: navigator.onLine,
	});
	const french = getLocale() === "fr";
	toast.error(french ? "Impossible de charger les données." : "Unable to load data.", {
		id: "data-load-error",
		richColors: true,
		duration: 10_000,
		description: french
			? "Le chargement a échoué ou prend trop de temps. Vous pouvez réessayer."
			: "Loading failed or took too long. You can try again.",
		action: {
			label: french ? "Réessayer" : "Retry",
			onClick: () => window.location.reload(),
		},
	});
}

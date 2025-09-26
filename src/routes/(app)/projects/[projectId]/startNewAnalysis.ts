import { defineContent } from "$lib/i18n/locale.svelte";
import { context } from "$lib/stores/context.svelte";
import { toast } from "svelte-sonner";
import { get } from "svelte/store";
import { startKeywordAnalysis } from "../../../api/keywords/index.remote";

const content = defineContent({
	en: {
		analysisStartedSuccess: "Analysis started. Wait a few minutes for the results to be ready.",
		analysisStartedError: "An error occurred while starting the analysis.",
		analysisStarting: "The analysis is starting...",
	},
	fr: {
		analysisStarting: "L'analyse est en cours de démarrage...",
		analysisStartedSuccess: "Analyse démarrée. Les résultats seront prêts dans quelques minutes.",
		analysisStartedError: "Une erreur est survenue lors du lancement de l'analyse.",
	},
});

export const startNewAnalysis = ({ projectId, then }: { projectId: string; then?: () => void }) => {
	toast.info(get(content).analysisStarting);
	startKeywordAnalysis({
		projectId: context.project!.id,
	})
		.then(() => {
			toast.success(get(content).analysisStartedSuccess, {
				richColors: true,
			});
			then?.();
		})
		.catch((error) => {
			console.error(error);
			toast.error(get(content).analysisStartedError, {
				richColors: true,
			});
		});
};

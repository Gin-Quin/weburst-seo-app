import type { KeywordAnalysisFrequency, ProjectType } from "../../../routes/api/projects.schema";
import { defineContent } from "../locale.svelte";

export const projectTypes = defineContent<Record<ProjectType, string>>({
	en: {
		audit: "Audit",
		monthly_subscription: "Monthly subscription",
	},
	fr: {
		audit: "Audit",
		monthly_subscription: "Abonnement mensuel",
	},
});

export function getProjectTypeLabel(
	labels: Record<ProjectType, string>,
	projectType: ProjectType | "prospect",
): string {
	return labels[projectType === "prospect" ? "audit" : projectType];
}

export const projectRoles = defineContent({
	en: {
		leader: "Chef de projet",
	},
	fr: {
		leader: "Chef de projet",
	},
});

export const keywordAnalysisFrequencies = defineContent<Record<KeywordAnalysisFrequency, string>>({
	en: {
		"1/month": "Once a month",
		"2/month": "Twice a month",
		"1/week": "Once a week",
		"1/day": "Once a day",
	},
	fr: {
		"1/month": "Une fois par mois",
		"2/month": "Deux fois par mois",
		"1/week": "Une fois par semaine",
		"1/day": "Une fois par jour",
	},
});

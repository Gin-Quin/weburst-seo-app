import type { KeywordAnalysisFrequency, ProjectType } from "../../../routes/(api)/projects.schema";
import { defineContent } from "../locale.svelte";

export const projectTypes = defineContent<Record<ProjectType, string>>({
	en: {
		audit: "Audit",
		prospect: "Prospect",
		redesign: "Redesign",
		subscription: "Subscription"
	},
	fr: {
		audit: "Audit",
		prospect: "Prospect",
		redesign: "Redesign",
		subscription: "Abonnement"
	}
})

export const projectRoles = defineContent({
	en: {
		leader: "Chef de projet",
	},
	fr: {
		leader: "Chef de projet",
	}
})

export const keywordAnalysisFrequencies = defineContent<Record<KeywordAnalysisFrequency, string>>({
	en: {
		"1/day": "Once a day",
		"1/week": "Once a week",
		"1/month": "Once a month",
		"2/month": "Twice a month",
	},
	fr: {
		"1/day": "Une fois par jour",
		"1/week": "Une fois par semaine",
		"1/month": "Une fois par mois",
		"2/month": "Deux fois par mois",
	}
})

import type { Project, Role } from "$lib/server/db/schema";
import { canViewProjectContents } from "$lib/contents/access";

export const CONTENT_QUOTA_EXCEEDED_MESSAGE =
	"Vous avez utilisé votre quota de contenus, veuillez passer à l'abonnement supérieur";

export type ContentCreationPolicy =
	| { allowed: false; limit: null }
	| { allowed: true; limit: number | null };

export function getContentCreationPolicy(
	role: Role,
	project: Pick<Project, "type" | "articleLimit">,
): ContentCreationPolicy {
	if (role !== "client") return { allowed: true, limit: null };
	if (!canViewProjectContents(role, project.type)) return { allowed: false, limit: null };
	return { allowed: true, limit: project.articleLimit };
}

export function isContentQuotaReached(currentCount: number, limit: number): boolean {
	return currentCount >= limit;
}

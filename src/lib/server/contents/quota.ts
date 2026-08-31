import type { Project, Role } from "$lib/server/db/schema";
import { canViewProjectContents } from "$lib/contents/access";

export const CONTENT_QUOTA_EXCEEDED_MESSAGE =
	"Vous avez utilisé votre quota de contenus, veuillez passer à l'abonnement supérieur";

export const CONTENT_QUOTA_WARNING_THRESHOLDS = [5, 2, 1, 0] as const;

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

export function getRemainingContentQuota(currentCount: number, limit: number): number {
	return Math.max(limit - currentCount, 0);
}

export function shouldSendContentQuotaWarning(remaining: number): boolean {
	return CONTENT_QUOTA_WARNING_THRESHOLDS.some((threshold) => threshold === remaining);
}

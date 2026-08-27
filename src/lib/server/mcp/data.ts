import { canViewProjectContents } from "$lib/contents/access";
import { extractHost } from "$lib/keywords/serpAnalytics";
import { canAccessProject } from "$lib/server/auth/authorization";
import { db } from "$lib/server/db";
import {
	clients,
	contents,
	projects,
	usersToClients,
	type Client,
	type Project,
	type User,
} from "$lib/server/db/schema";
import { KeywordsService } from "$lib/server/clickhouse/services/keywords";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import TurndownService from "turndown";
import { formatKeywordSimilarityAnalysis, formatShareOfVoiceAnalysis } from "./analytics";
import { canReadMcpClients } from "./permissions";

const turndown = new TurndownService({
	bulletListMarker: "-",
	codeBlockStyle: "fenced",
	headingStyle: "atx",
});

export type McpProject = {
	id: string;
	name: string;
	client: { id: string; name: string } | null;
	domain: string;
	websiteUrl: string;
	type: Project["type"];
	keywordAnalysisFrequency: Project["keywordAnalysisFrequency"];
	articleLimit: number;
};

export type McpClient = {
	id: string;
	name: string;
	context: string;
	createdAt: string;
	updatedAt: string;
	projects: Array<Pick<McpProject, "id" | "name" | "domain" | "type">>;
};

export type McpContentSummary = {
	id: string;
	project: { id: string; name: string };
	title: string;
	cluster: string | null;
	priority: string | null;
	status: string;
	score: number | null;
	archived: boolean;
	createdAt: string;
	updatedAt: string;
};

export async function listMcpProjects(user: User): Promise<McpProject[]> {
	const rows =
		user.role === "admin"
			? await db
					.select({ project: projects, client: clients })
					.from(projects)
					.leftJoin(clients, eq(clients.id, projects.clientId))
					.where(isNull(projects.deletedAt))
			: await db
					.select({ project: projects, client: clients })
					.from(usersToClients)
					.innerJoin(
						projects,
						and(eq(projects.clientId, usersToClients.clientId), isNull(projects.deletedAt)),
					)
					.leftJoin(clients, eq(clients.id, projects.clientId))
					.where(eq(usersToClients.userId, user.id));

	return [
		...new Map(rows.map((row) => [row.project.id, toMcpProject(row.project, row.client)])).values(),
	];
}

export async function getMcpProject(user: User, projectId: string): Promise<McpProject> {
	const [row] = await db
		.select({ project: projects, client: clients })
		.from(projects)
		.leftJoin(clients, eq(clients.id, projects.clientId))
		.where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
		.limit(1);
	if (!row || !(await canAccessProject(user, row.project, "view"))) {
		throw new Error("Project not found or not available to this profile.");
	}
	return toMcpProject(row.project, row.client);
}

export async function getMcpProjectShareOfVoice(
	user: User,
	projectId: string,
	options: { domainLimit: number; historyPoints: number },
) {
	const project = await getMcpProject(user, projectId);
	const latest = await KeywordsService.getProjectLatestAggregatedAnalysisResults({ projectId });
	let history: Awaited<ReturnType<typeof KeywordsService.getAllAggregatedAnalysisResults>> = [];
	if (options.historyPoints > 0) {
		const topDomainHistory = await KeywordsService.getAllAggregatedAnalysisResults({
			projectId,
			domainLimit: options.domainLimit,
		});
		const projectDomainRank =
			latest?.data.findIndex(({ domain }) => domain === extractHost(project.domain)) ?? -1;
		const projectDomainHistory =
			projectDomainRank === -1 || projectDomainRank >= options.domainLimit
				? await KeywordsService.getAllAggregatedAnalysisResults({
						projectId,
						domain: extractHost(project.domain),
					})
				: [];
		history = [
			...new Map(
				[...topDomainHistory, ...projectDomainHistory].map((row) => [
					`${row.createdAt}\u0000${row.domain}`,
					row,
				]),
			).values(),
		];
	}

	return formatShareOfVoiceAnalysis({
		project: { id: project.id, name: project.name, domain: project.domain },
		latest,
		history,
		domainLimit: options.domainLimit,
		historyPoints: options.historyPoints,
	});
}

export async function getMcpProjectKeywordSimilarities(
	user: User,
	projectId: string,
	options: {
		clusterOffset: number;
		clusterLimit: number;
		includeSerpPages: boolean;
		serpPageLimit: number;
	},
) {
	const project = await getMcpProject(user, projectId);
	const [clusters, analyses] = await Promise.all([
		KeywordsService.getKeywordClusters({ projectId }),
		KeywordsService.getAllProjectAnalysis(projectId),
	]);
	return formatKeywordSimilarityAnalysis({
		project: { id: project.id, name: project.name, domain: project.domain },
		clusters,
		analysis: analyses[0] ?? null,
		...options,
	});
}

export async function listMcpClients(user: User): Promise<McpClient[]> {
	assertCanReadClients(user);
	const clientRows =
		user.role === "admin"
			? await db.select().from(clients).where(isNull(clients.deletedAt))
			: (
					await db
						.select({ client: clients })
						.from(usersToClients)
						.innerJoin(
							clients,
							and(eq(clients.id, usersToClients.clientId), isNull(clients.deletedAt)),
						)
						.where(eq(usersToClients.userId, user.id))
				).map(({ client }) => client);
	return attachClientProjects(clientRows);
}

export async function getMcpClient(user: User, clientId: string): Promise<McpClient> {
	const client = (await listMcpClients(user)).find(({ id }) => id === clientId);
	if (!client) throw new Error("Client not found or not available to this profile.");
	return client;
}

export async function listMcpContents(
	user: User,
	options: { projectId?: string; includeArchived?: boolean } = {},
): Promise<McpContentSummary[]> {
	const projectList = (await listMcpProjects(user)).filter((project) =>
		canViewProjectContents(user.role, project.type),
	);
	const selectedProjects = options.projectId
		? projectList.filter(({ id }) => id === options.projectId)
		: projectList;
	if (options.projectId && selectedProjects.length === 0) {
		throw new Error("Project not found or its contents are not available to this profile.");
	}
	if (selectedProjects.length === 0) return [];

	const projectById = new Map(selectedProjects.map((project) => [project.id, project]));
	const rows = await db
		.select({
			id: contents.id,
			projectId: contents.projectId,
			title: contents.title,
			cluster: contents.cluster,
			priority: contents.priority,
			status: contents.status,
			score: contents.score,
			createdAt: contents.createdAt,
			updatedAt: contents.updatedAt,
			archivedAt: contents.archivedAt,
		})
		.from(contents)
		.where(
			and(
				inArray(contents.projectId, [...projectById.keys()]),
				options.includeArchived ? undefined : isNull(contents.archivedAt),
			),
		)
		.orderBy(desc(contents.updatedAt));

	return rows.map((content) => ({
		id: content.id,
		project: {
			id: content.projectId,
			name: projectById.get(content.projectId)?.name ?? "Unknown project",
		},
		title: content.title,
		cluster: content.cluster,
		priority: content.priority,
		status: content.status,
		score: content.score,
		archived: content.archivedAt !== null,
		createdAt: toIsoDate(content.createdAt),
		updatedAt: toIsoDate(content.updatedAt),
	}));
}

export async function getMcpContent(user: User, contentId: string, format: "html" | "markdown") {
	const [row] = await db
		.select({ content: contents, project: projects })
		.from(contents)
		.innerJoin(projects, eq(projects.id, contents.projectId))
		.where(and(eq(contents.id, contentId), isNull(projects.deletedAt)))
		.limit(1);
	if (
		!row ||
		!(await canAccessProject(user, row.project, "view")) ||
		!canViewProjectContents(user.role, row.project.type)
	) {
		throw new Error("Content not found or not available to this profile.");
	}

	return {
		id: row.content.id,
		project: { id: row.project.id, name: row.project.name },
		title: row.content.title,
		cluster: row.content.cluster,
		priority: row.content.priority,
		status: row.content.status,
		brief: row.content.brief,
		existingUrl: row.content.existingUrl,
		score: row.content.score,
		format,
		mimeType: format === "html" ? "text/html" : "text/markdown",
		content:
			format === "html" ? row.content.contentHtml : turndown.turndown(row.content.contentHtml),
		createdAt: toIsoDate(row.content.createdAt),
		updatedAt: toIsoDate(row.content.updatedAt),
	};
}

function assertCanReadClients(user: User): void {
	if (!canReadMcpClients(user.role)) {
		throw new Error("Client tools are only available to admins and project managers.");
	}
}

async function attachClientProjects(clientList: Client[]): Promise<McpClient[]> {
	if (clientList.length === 0) return [];
	const projectRows = await db
		.select()
		.from(projects)
		.where(
			and(
				inArray(
					projects.clientId,
					clientList.map(({ id }) => id),
				),
				isNull(projects.deletedAt),
			),
		);
	const projectsByClient = new Map<string, Project[]>();
	for (const project of projectRows) {
		if (!project.clientId) continue;
		const current = projectsByClient.get(project.clientId) ?? [];
		current.push(project);
		projectsByClient.set(project.clientId, current);
	}
	return clientList.map((client) => ({
		id: client.id,
		name: client.name,
		context: client.context,
		createdAt: toIsoDate(client.createdAt),
		updatedAt: toIsoDate(client.updatedAt),
		projects: (projectsByClient.get(client.id) ?? []).map((project) => ({
			id: project.id,
			name: project.name,
			domain: project.domain,
			type: project.type,
		})),
	}));
}

function toMcpProject(project: Project, client: Client | null): McpProject {
	return {
		id: project.id,
		name: project.name,
		client: client ? { id: client.id, name: client.name } : null,
		domain: project.domain,
		websiteUrl: project.websiteUrl,
		type: project.type,
		keywordAnalysisFrequency: project.keywordAnalysisFrequency,
		articleLimit: project.articleLimit,
	};
}

function toIsoDate(value: number): string {
	return new Date(value).toISOString();
}

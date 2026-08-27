import type { User } from "$lib/server/db/schema";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { MCP_SCOPE, MCP_SERVER_NAME, MCP_SERVER_VERSION } from "./config";
import {
	getMcpClient,
	getMcpContent,
	getMcpProject,
	getMcpProjectKeywordSimilarities,
	getMcpProjectShareOfVoice,
	listMcpClients,
	listMcpContents,
	listMcpProjects,
} from "./data";

const readOnlyAnnotations = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: false,
} as const;

const authMeta = {
	securitySchemes: [{ type: "oauth2", scopes: [MCP_SCOPE] }],
};

export function createWeburstMcpServer(user: User): McpServer {
	const server = new McpServer(
		{ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
		{
			instructions:
				"Read-only access to the authenticated user's WeBurst SEO projects, share-of-voice analyses, keyword similarities, clients and editorial contents. Use list tools before detail tools when an identifier is unknown.",
		},
	);

	server.registerTool(
		"list_projects",
		{
			title: "List WeBurst projects",
			description:
				"List every active SEO project available to the authenticated WeBurst profile. Returns stable project IDs for get_project and content filtering.",
			inputSchema: z.object({}),
			annotations: readOnlyAnnotations,
			_meta: authMeta,
		},
		async () => jsonResult(await listMcpProjects(user)),
	);

	server.registerTool(
		"get_project",
		{
			title: "Read a WeBurst project",
			description:
				"Read the SEO configuration and client identity of one project available to the authenticated profile.",
			inputSchema: z.object({
				project_id: z.string().min(1).describe("Project ID returned by list_projects"),
			}),
			annotations: readOnlyAnnotations,
			_meta: authMeta,
		},
		async ({ project_id }) => jsonResult(await getMcpProject(user, project_id)),
	);

	server.registerTool(
		"get_project_share_of_voice",
		{
			title: "Analyze a WeBurst project's share of voice",
			description:
				"Read the latest share-of-voice results for a project, including ranked domains, weighted visibility, percentage shares, SEO keyword counts, cluster breakdowns and optional daily history.",
			inputSchema: z.object({
				project_id: z.string().min(1).describe("Project ID returned by list_projects"),
				domain_limit: z
					.number()
					.int()
					.min(1)
					.max(100)
					.optional()
					.default(20)
					.describe("Maximum number of leading competitor domains to return"),
				history_points: z
					.number()
					.int()
					.min(0)
					.max(365)
					.optional()
					.default(30)
					.describe("Maximum number of daily historical analyses; use 0 to omit history"),
			}),
			annotations: readOnlyAnnotations,
			_meta: authMeta,
		},
		async ({ project_id, domain_limit, history_points }) =>
			jsonResult(
				await getMcpProjectShareOfVoice(user, project_id, {
					domainLimit: domain_limit,
					historyPoints: history_points,
				}),
			),
	);

	server.registerTool(
		"get_project_keyword_similarities",
		{
			title: "Analyze a WeBurst project's keyword similarities",
			description:
				"Read the latest SERP-similarity groups for a project. Returns main and related keywords, search volumes, configured clusters and optionally their positioned top-10 pages.",
			inputSchema: z.object({
				project_id: z.string().min(1).describe("Project ID returned by list_projects"),
				cluster_offset: z
					.number()
					.int()
					.min(0)
					.optional()
					.default(0)
					.describe("Zero-based cluster offset for pagination"),
				cluster_limit: z
					.number()
					.int()
					.min(1)
					.max(100)
					.optional()
					.default(25)
					.describe("Maximum number of similarity clusters to return"),
				include_serp_pages: z
					.boolean()
					.optional()
					.default(false)
					.describe("Include positioned SERP pages used to understand each group"),
				serp_page_limit: z
					.number()
					.int()
					.min(1)
					.max(10)
					.optional()
					.default(10)
					.describe("Maximum positioned pages per keyword when pages are included"),
			}),
			annotations: readOnlyAnnotations,
			_meta: authMeta,
		},
		async ({ project_id, cluster_offset, cluster_limit, include_serp_pages, serp_page_limit }) =>
			jsonResult(
				await getMcpProjectKeywordSimilarities(user, project_id, {
					clusterOffset: cluster_offset,
					clusterLimit: cluster_limit,
					includeSerpPages: include_serp_pages,
					serpPageLimit: serp_page_limit,
				}),
			),
	);

	server.registerTool(
		"list_clients",
		{
			title: "List WeBurst clients",
			description:
				"List clients available to the authenticated profile. This tool is restricted to admins and project managers.",
			inputSchema: z.object({}),
			annotations: readOnlyAnnotations,
			_meta: authMeta,
		},
		async () => jsonResult(await listMcpClients(user)),
	);

	server.registerTool(
		"get_client",
		{
			title: "Read a WeBurst client",
			description:
				"Read one client's context and active projects. This tool is restricted to admins and project managers.",
			inputSchema: z.object({
				client_id: z.string().min(1).describe("Client ID returned by list_clients"),
			}),
			annotations: readOnlyAnnotations,
			_meta: authMeta,
		},
		async ({ client_id }) => jsonResult(await getMcpClient(user, client_id)),
	);

	server.registerTool(
		"list_contents",
		{
			title: "List WeBurst contents",
			description:
				"List editorial contents across projects available to the authenticated profile. Optionally filter by project and include archived contents.",
			inputSchema: z.object({
				project_id: z
					.string()
					.min(1)
					.optional()
					.describe("Optional project ID returned by list_projects"),
				include_archived: z
					.boolean()
					.optional()
					.default(false)
					.describe("Whether archived contents should be included"),
			}),
			annotations: readOnlyAnnotations,
			_meta: authMeta,
		},
		async ({ project_id, include_archived }) =>
			jsonResult(
				await listMcpContents(user, {
					projectId: project_id,
					includeArchived: include_archived,
				}),
			),
	);

	server.registerTool(
		"get_content",
		{
			title: "Read a complete WeBurst content",
			description:
				"Read one complete editorial content available to the profile, including its brief and full article body converted to HTML or Markdown.",
			inputSchema: z.object({
				content_id: z.string().min(1).describe("Content ID returned by list_contents"),
				format: z
					.enum(["html", "markdown"])
					.optional()
					.default("markdown")
					.describe("Format of the complete article body"),
			}),
			annotations: readOnlyAnnotations,
			_meta: authMeta,
		},
		async ({ content_id, format }) => jsonResult(await getMcpContent(user, content_id, format)),
	);

	return server;
}

function jsonResult(value: unknown) {
	return {
		content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
	};
}

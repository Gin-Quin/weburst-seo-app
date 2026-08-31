import { relations } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { UserId } from "lucia";
import type { KeywordAnalysisFrequency } from "../../../routes/api/projects.schema";

/** `user` is kept temporarily for compatibility with databases not yet migrated. */
export type Role = "admin" | "user" | "project_manager" | "client";

const usersSchema = {
	id: text("id").primaryKey(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	role: text("role").$type<Role>().notNull(),
	email: text("email").unique().notNull(),

	hashedPassword: text("hashed_password"),
	emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
	clientInvitationEmailsEnabled: integer("client_invitation_emails_enabled", {
		mode: "boolean",
	})
		.notNull()
		.default(true),
	createdAt: integer("created_at").notNull().default(Date.now()),
	updatedAt: integer("updated_at").notNull().default(Date.now()),
} as const;

export const users = sqliteTable("users", usersSchema);
export type User = typeof users.$inferSelect;

export const deletedUsers = sqliteTable("deleted_users", {
	id: text("id").primaryKey(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	role: text("role").$type<Role>().notNull(),
	email: text("email").notNull(),
	hashedPassword: text("hashed_password"),
	emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
	clientInvitationEmailsEnabled: integer("client_invitation_emails_enabled", {
		mode: "boolean",
	})
		.notNull()
		.default(true),
	createdAt: integer("created_at").notNull().default(Date.now()),
	updatedAt: integer("updated_at").notNull().default(Date.now()),
	deletedAt: integer("deleted_at").notNull().default(Date.now()),
});
export type DeletedUser = typeof deletedUsers.$inferSelect;

export const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.$type<UserId>()
		.references(() => users.id, { onDelete: "cascade" }),
	expiresAt: integer("expires_at").notNull(),
});
export type Session = typeof sessions.$inferSelect;

export type McpTokenKind = "api_key" | "oauth_access" | "oauth_refresh";

/**
 * Authentication material for the MCP endpoint. Only SHA-256 hashes are
 * persisted; the clear-text API key or OAuth access token is shown once.
 */
export const mcpTokens = sqliteTable(
	"mcp_tokens",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		kind: text("kind").$type<McpTokenKind>().notNull(),
		tokenHash: text("token_hash").notNull().unique(),
		prefix: text("prefix").notNull(),
		clientId: text("client_id"),
		scope: text("scope").notNull().default("weburst.read"),
		resource: text("resource"),
		createdAt: integer("created_at")
			.notNull()
			.$defaultFn(() => Date.now()),
		expiresAt: integer("expires_at"),
		lastUsedAt: integer("last_used_at"),
		revokedAt: integer("revoked_at"),
	},
	(table) => [
		index("mcp_tokens_user_kind_idx").on(table.userId, table.kind),
		index("mcp_tokens_client_id_idx").on(table.clientId),
	],
);
export type McpToken = typeof mcpTokens.$inferSelect;

/** OAuth public clients created through Dynamic Client Registration. */
export const mcpOauthClients = sqliteTable("mcp_oauth_clients", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	redirectUrisJson: text("redirect_uris_json").notNull(),
	createdAt: integer("created_at")
		.notNull()
		.$defaultFn(() => Date.now()),
});
export type McpOauthClient = typeof mcpOauthClients.$inferSelect;

/** Short-lived, single-use OAuth authorization codes with PKCE. */
export const mcpOauthCodes = sqliteTable(
	"mcp_oauth_codes",
	{
		codeHash: text("code_hash").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		clientId: text("client_id")
			.notNull()
			.references(() => mcpOauthClients.id, { onDelete: "cascade" }),
		redirectUri: text("redirect_uri").notNull(),
		codeChallenge: text("code_challenge").notNull(),
		scope: text("scope").notNull(),
		resource: text("resource").notNull(),
		createdAt: integer("created_at")
			.notNull()
			.$defaultFn(() => Date.now()),
		expiresAt: integer("expires_at").notNull(),
		usedAt: integer("used_at"),
	},
	(table) => [index("mcp_oauth_codes_expiry_idx").on(table.expiresAt)],
);

export const authenticationTokens = sqliteTable("authorization_tokens", {
	id: text("id").primaryKey(),
	email: text("email").notNull(),
	code: text("code").notNull(),
	codeAttempts: integer("code_attempts").notNull().default(0),
	magicLinkToken: text("magic_link_code").notNull(),
	expiresAt: integer("expires_at").notNull(),
});

export const clients = sqliteTable("clients", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	context: text("context").notNull().default(""),
	createdAt: integer("created_at")
		.notNull()
		.$defaultFn(() => Date.now()),
	updatedAt: integer("updated_at")
		.notNull()
		.$defaultFn(() => Date.now()),
	deletedAt: integer("deleted_at"),
});
export type Client = typeof clients.$inferSelect;

export const clientContextFiles = sqliteTable(
	"client_context_files",
	{
		id: text("id").primaryKey(),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		mimeType: text("mime_type").notNull(),
		size: integer("size").notNull(),
		content: text("content").notNull(),
		createdAt: integer("created_at")
			.notNull()
			.$defaultFn(() => Date.now()),
	},
	(table) => [index("client_context_files_client_id_idx").on(table.clientId)],
);
export type ClientContextFile = typeof clientContextFiles.$inferSelect;

export const projects = sqliteTable(
	"projects",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		// Kept temporarily so the migration can be deployed before every caller
		// switches to clientId.
		clientName: text("client_name").notNull(),
		clientId: text("client_id").references(() => clients.id),
		domain: text("domain").notNull(),
		websiteUrl: text("website_url").notNull(),
		// `prospect` remains readable for legacy rows, but new API inputs reject it.
		type: text("type").$type<"audit" | "prospect" | "monthly_subscription">().notNull(),
		keywordAnalysisFrequency: text("keyword_analysis_frequency")
			.$type<KeywordAnalysisFrequency>()
			.notNull(),
		articleLimit: integer("article_limit").notNull().default(10),
		shareOfVoiceEnabled: integer("share_of_voice_enabled", { mode: "boolean" })
			.notNull()
			.default(true),
		contentWritingEnabled: integer("content_writing_enabled", { mode: "boolean" })
			.notNull()
			.default(true),
		deletedAt: integer("deleted_at"),
	},
	(table) => [index("projects_client_id_idx").on(table.clientId)],
);
export type Project = typeof projects.$inferSelect;

export type ContentPriority = "high" | "moderate" | "low";
export type ContentStatus = "new" | "in_progress" | "done";
export type SerpmanticsStatus = "pending" | "ready" | "failed";

export const contents = sqliteTable(
	"contents",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		cluster: text("cluster"),
		priority: text("priority").$type<ContentPriority>(),
		existingUrl: text("existing_url"),
		brief: text("brief").notNull().default(""),
		contentHtml: text("content_html").notNull().default(""),
		contentText: text("content_text").notNull().default(""),
		contentJson: text("content_json")
			.notNull()
			.default('{"type":"doc","content":[{"type":"paragraph"}]}'),
		status: text("status").$type<ContentStatus>().notNull().default("new"),
		serpmanticsGuideId: text("serpmantics_guide_id"),
		serpmanticsStatus: text("serpmantics_status")
			.$type<SerpmanticsStatus>()
			.notNull()
			.default("pending"),
		serpmanticsError: text("serpmantics_error"),
		serpmanticsGuideJson: text("serpmantics_guide_json"),
		serpmanticsAnalysisJson: text("serpmantics_analysis_json"),
		score: real("score"),
		chatMessagesJson: text("chat_messages_json").notNull().default("[]"),
		createdAt: integer("created_at")
			.notNull()
			.$defaultFn(() => Date.now()),
		updatedAt: integer("updated_at")
			.notNull()
			.$defaultFn(() => Date.now()),
		archivedAt: integer("archived_at"),
	},
	(table) => [
		index("contents_project_id_idx").on(table.projectId),
		index("contents_project_archived_idx").on(table.projectId, table.archivedAt),
	],
);
export type Content = typeof contents.$inferSelect;

export const contentVersions = sqliteTable(
	"content_versions",
	{
		id: text("id").primaryKey(),
		contentId: text("content_id")
			.notNull()
			.references(() => contents.id, { onDelete: "cascade" }),
		version: integer("version").notNull(),
		title: text("title").notNull(),
		brief: text("brief").notNull(),
		contentHtml: text("content_html").notNull(),
		contentText: text("content_text").notNull(),
		contentJson: text("content_json").notNull(),
		score: real("score"),
		serpmanticsGuideJson: text("serpmantics_guide_json"),
		serpmanticsAnalysisJson: text("serpmantics_analysis_json"),
		createdAt: integer("created_at")
			.notNull()
			.$defaultFn(() => Date.now()),
	},
	(table) => [
		index("content_versions_content_id_idx").on(table.contentId),
		index("content_versions_content_version_idx").on(table.contentId, table.version),
	],
);
export type ContentVersion = typeof contentVersions.$inferSelect;

/**
 * Grants a non-admin user access to every project owned by a client.
 * Project managers may have multiple rows; client users are limited to one
 * row by the service layer.
 */
export const usersToClients = sqliteTable(
	"users_to_clients",
	{
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.clientId] }),
		index("users_to_clients_client_id_idx").on(table.clientId),
	],
);

export const usersToProjects = sqliteTable("users_to_projects", {
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	projectId: text("project_id")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),
});

// ------------------------- RELATIONS ------------------------- //

export const usersRelations = relations(users, ({ many, one }) => ({
	memberships: many(usersToProjects),
	clientMemberships: many(usersToClients),
	sessions: many(sessions),
	mcpTokens: many(mcpTokens),
}));

export const mcpTokensRelations = relations(mcpTokens, ({ one }) => ({
	user: one(users, {
		fields: [mcpTokens.userId],
		references: [users.id],
	}),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
	projects: many(projects),
	memberships: many(usersToClients),
	contextFiles: many(clientContextFiles),
}));

export const clientContextFilesRelations = relations(clientContextFiles, ({ one }) => ({
	client: one(clients, {
		fields: [clientContextFiles.clientId],
		references: [clients.id],
	}),
}));

export const usersToClientsRelations = relations(usersToClients, ({ one }) => ({
	user: one(users, {
		fields: [usersToClients.userId],
		references: [users.id],
	}),
	client: one(clients, {
		fields: [usersToClients.clientId],
		references: [clients.id],
	}),
}));

export const usersToProjectsRelations = relations(usersToProjects, ({ one }) => ({
	user: one(users, {
		fields: [usersToProjects.userId],
		references: [users.id],
	}),
	project: one(projects, {
		fields: [usersToProjects.projectId],
		references: [projects.id],
	}),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}));

export const projectsRelations = relations(projects, ({ many, one }) => ({
	memberships: many(usersToProjects),
	contents: many(contents),
	client: one(clients, {
		fields: [projects.clientId],
		references: [clients.id],
	}),
}));

export const contentsRelations = relations(contents, ({ many, one }) => ({
	project: one(projects, {
		fields: [contents.projectId],
		references: [projects.id],
	}),
	versions: many(contentVersions),
}));

export const contentVersionsRelations = relations(contentVersions, ({ one }) => ({
	content: one(contents, {
		fields: [contentVersions.contentId],
		references: [contents.id],
	}),
}));

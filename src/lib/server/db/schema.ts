import { relations } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
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
	createdAt: integer("created_at")
		.notNull()
		.$defaultFn(() => Date.now()),
	updatedAt: integer("updated_at")
		.notNull()
		.$defaultFn(() => Date.now()),
	deletedAt: integer("deleted_at"),
});
export type Client = typeof clients.$inferSelect;

export const projects = sqliteTable(
	"projects",
	{
		id: text("id").primaryKey(),
		// Kept temporarily so the migration can be deployed before every caller
		// switches to clientId.
		clientName: text("client_name").notNull(),
		clientId: text("client_id").references(() => clients.id),
		domain: text("domain").notNull(),
		websiteUrl: text("website_url").notNull(),
		type: text("type").$type<"audit" | "prospect">().notNull(),
		keywordAnalysisFrequency: text("keyword_analysis_frequency")
			.$type<KeywordAnalysisFrequency>()
			.notNull(),
		deletedAt: integer("deleted_at"),
	},
	(table) => [index("projects_client_id_idx").on(table.clientId)],
);
export type Project = typeof projects.$inferSelect;

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
}));

export const clientsRelations = relations(clients, ({ many }) => ({
	projects: many(projects),
	memberships: many(usersToClients),
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
	client: one(clients, {
		fields: [projects.clientId],
		references: [clients.id],
	}),
}));

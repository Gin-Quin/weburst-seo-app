import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { UserId } from "lucia";
import type { KeywordAnalysisFrequency } from "../../../routes/api/projects.schema";

export type Role = "admin" | "user";

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

export const projects = sqliteTable("projects", {
	id: text("id").primaryKey(),
	clientName: text("client_name").notNull(),
	domain: text("domain").notNull(),
	websiteUrl: text("website_url").notNull(),
	type: text("type").$type<"audit" | "prospect">().notNull(),
	keywordAnalysisFrequency: text("keyword_analysis_frequency")
		.$type<KeywordAnalysisFrequency>()
		.notNull(),
	deletedAt: integer("deleted_at"),
});
export type Project = typeof projects.$inferSelect;

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
	sessions: many(sessions),
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
}));

import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { UserId } from "lucia";

export type Role = "admin" | "leader" | "manager";

const usersSchema = {
	id: text("id").primaryKey(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	role: text("role").$type<Role>().notNull(),
	email: text("email").unique().notNull(),
	projectId: text("project_id"),
	hashedPassword: text("hashed_password"),
	emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
	createdAt: integer("created_at").notNull().default(Date.now()),
	updatedAt: integer("updated_at").notNull().default(Date.now()),
} as const;

export const users = sqliteTable("users", usersSchema);
export type User = typeof users.$inferSelect;

export const deletedUsers = sqliteTable("deleted_users", {
	...usersSchema,
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

export const oauthAccounts = sqliteTable("oauth_accounts", {
	providerId: text("provider_id").primaryKey(),
	providerUserId: text("provider_user_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
});

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
	type: text("type").$type<"audit" | "redesign" | "subscription" | "prospect">().notNull(),
	keywordAnalysisPerMonth: integer("keyword_analysis_per_month").notNull(),
});
export type Project = typeof projects.$inferSelect;

// ------------------------- RELATIONS ------------------------- //

export const usersRelations = relations(users, ({ one, many }) => ({
	project: one(projects, {
		fields: [users.projectId],
		references: [projects.id],
	}),
	sessions: many(sessions),
	oauthAccounts: many(oauthAccounts),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}));

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
	user: one(users, {
		fields: [oauthAccounts.userId],
		references: [users.id],
	}),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
	users: many(users),
}));

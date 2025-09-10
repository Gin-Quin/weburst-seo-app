import { relations } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { UserId } from "lucia";

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	role: text("role").$type<"admin" | "leader" | "manager">().notNull(),
	email: text("email").unique().notNull(),
	projectId: text("project_id"),
	hashedPassword: text("hashed_password"),
	emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
	createdAt: integer("created_at").notNull().default(Date.now()),
	updatedAt: integer("updated_at").notNull().default(Date.now()),
});

export const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.$type<UserId>()
		.references(() => users.id, { onDelete: "cascade" }),
	expiresAt: integer("expires_at").notNull(),
});

export const oauthAccounts = sqliteTable("oauth_accounts", {
	providerId: text("provider_id").primaryKey(),
	providerUserId: text("provider_user_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
});

export const emailVerificationTokens = sqliteTable(
	"email_verification_tokens",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		token: text("token").notNull().unique(),
		expiresAt: integer("expires_at").notNull(),
	},
);

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	token: text("token").notNull().unique(),
	expiresAt: integer("expires_at").notNull(),
});

export const magicLinkTokens = sqliteTable("magic_link_tokens", {
	id: text("id").primaryKey(),
	email: text("email").notNull(),
	token: text("token").notNull().unique(),
	expiresAt: integer("expires_at").notNull(),
});

export const projects = sqliteTable("projects", {
	id: text("id").primaryKey(),
	clientName: text("client_name").notNull(),
	domain: text("domain").notNull(),
	websiteUrl: text("website_url").notNull(),
	type: text("type")
		.$type<"audit" | "redesign" | "subscription" | "prospect">()
		.notNull(),
	keywordAnalysisPerMonth: integer("keyword_analysis_per_month").notNull(),
});

// ------------------------- RELATIONS ------------------------- //

export const usersRelations = relations(users, ({ one, many }) => ({
	project: one(projects, {
		fields: [users.projectId],
		references: [projects.id],
	}),
	sessions: many(sessions),
	oauthAccounts: many(oauthAccounts),
	emailVerificationTokens: many(emailVerificationTokens),
	passwordResetTokens: many(passwordResetTokens),
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

export const emailVerificationTokensRelations = relations(
	emailVerificationTokens,
	({ one }) => ({
		user: one(users, {
			fields: [emailVerificationTokens.userId],
			references: [users.id],
		}),
	}),
);

export const passwordResetTokensRelations = relations(
	passwordResetTokens,
	({ one }) => ({
		user: one(users, {
			fields: [passwordResetTokens.userId],
			references: [users.id],
		}),
	}),
);

export const projectsRelations = relations(projects, ({ many }) => ({
	users: many(users),
}));

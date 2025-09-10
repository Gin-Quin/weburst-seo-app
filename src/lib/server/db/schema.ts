import { relations } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	role: text("role").$type<"admin" | "leader" | "manager">().notNull(),
	email: text("email").unique().notNull(),
	projectId: text("project_id"),
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

export const usersRelations = relations(users, ({ one }) => ({
	user: one(projects, {
		fields: [users.projectId],
		references: [projects.id],
	}),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
	projects: many(users),
}));

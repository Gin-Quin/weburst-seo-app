DROP INDEX "users_email_unique";--> statement-breakpoint
ALTER TABLE `deleted_users` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT 1758025095989;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `deleted_users` ALTER COLUMN "updated_at" TO "updated_at" integer NOT NULL DEFAULT 1758025095989;--> statement-breakpoint
ALTER TABLE `deleted_users` ALTER COLUMN "deleted_at" TO "deleted_at" integer NOT NULL DEFAULT 1758025095989;--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT 1758025095989;--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "updated_at" TO "updated_at" integer NOT NULL DEFAULT 1758025095989;
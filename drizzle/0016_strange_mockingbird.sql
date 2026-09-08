DROP INDEX "client_context_files_client_id_idx";--> statement-breakpoint
DROP INDEX "content_chats_user_id_idx";--> statement-breakpoint
DROP INDEX "content_typologies_client_idx";--> statement-breakpoint
DROP INDEX "content_versions_content_id_idx";--> statement-breakpoint
DROP INDEX "content_versions_content_version_idx";--> statement-breakpoint
DROP INDEX "contents_project_id_idx";--> statement-breakpoint
DROP INDEX "contents_project_archived_idx";--> statement-breakpoint
DROP INDEX "mcp_oauth_codes_expiry_idx";--> statement-breakpoint
DROP INDEX "mcp_tokens_token_hash_unique";--> statement-breakpoint
DROP INDEX "mcp_tokens_user_kind_idx";--> statement-breakpoint
DROP INDEX "mcp_tokens_client_id_idx";--> statement-breakpoint
DROP INDEX "projects_client_id_idx";--> statement-breakpoint
DROP INDEX "users_email_unique";--> statement-breakpoint
DROP INDEX "users_to_clients_client_id_idx";--> statement-breakpoint
ALTER TABLE `deleted_users` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT 1788882294469;--> statement-breakpoint
CREATE INDEX `client_context_files_client_id_idx` ON `client_context_files` (`client_id`);--> statement-breakpoint
CREATE INDEX `content_chats_user_id_idx` ON `content_chats` (`user_id`);--> statement-breakpoint
CREATE INDEX `content_typologies_client_idx` ON `content_typologies` (`client_id`);--> statement-breakpoint
CREATE INDEX `content_versions_content_id_idx` ON `content_versions` (`content_id`);--> statement-breakpoint
CREATE INDEX `content_versions_content_version_idx` ON `content_versions` (`content_id`,`version`);--> statement-breakpoint
CREATE INDEX `contents_project_id_idx` ON `contents` (`project_id`);--> statement-breakpoint
CREATE INDEX `contents_project_archived_idx` ON `contents` (`project_id`,`archived_at`);--> statement-breakpoint
CREATE INDEX `mcp_oauth_codes_expiry_idx` ON `mcp_oauth_codes` (`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_tokens_token_hash_unique` ON `mcp_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `mcp_tokens_user_kind_idx` ON `mcp_tokens` (`user_id`,`kind`);--> statement-breakpoint
CREATE INDEX `mcp_tokens_client_id_idx` ON `mcp_tokens` (`client_id`);--> statement-breakpoint
CREATE INDEX `projects_client_id_idx` ON `projects` (`client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_to_clients_client_id_idx` ON `users_to_clients` (`client_id`);--> statement-breakpoint
ALTER TABLE `deleted_users` ALTER COLUMN "updated_at" TO "updated_at" integer NOT NULL DEFAULT 1788882294469;--> statement-breakpoint
ALTER TABLE `deleted_users` ALTER COLUMN "deleted_at" TO "deleted_at" integer NOT NULL DEFAULT 1788882294469;--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT 1788882294468;--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "updated_at" TO "updated_at" integer NOT NULL DEFAULT 1788882294468;
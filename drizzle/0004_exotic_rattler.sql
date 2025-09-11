CREATE TABLE `authorization_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`code` text NOT NULL,
	`code_attempts` integer DEFAULT 0 NOT NULL,
	`magic_link_code` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
DROP TABLE `email_verification_tokens`;--> statement-breakpoint
DROP INDEX "users_email_unique";--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT 1757603655992;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "updated_at" TO "updated_at" integer NOT NULL DEFAULT 1757603655992;
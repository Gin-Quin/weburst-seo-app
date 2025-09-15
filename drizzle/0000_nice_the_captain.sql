CREATE TABLE `authorization_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`code` text NOT NULL,
	`code_attempts` integer DEFAULT 0 NOT NULL,
	`magic_link_code` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deleted_users` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`role` text NOT NULL,
	`email` text NOT NULL,
	`hashed_password` text,
	`email_verified` integer DEFAULT false,
	`created_at` integer DEFAULT 1757947949121 NOT NULL,
	`updated_at` integer DEFAULT 1757947949121 NOT NULL,
	`deleted_at` integer DEFAULT 1757947949121 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`client_name` text NOT NULL,
	`domain` text NOT NULL,
	`website_url` text NOT NULL,
	`type` text NOT NULL,
	`keyword_analysis_frequency` text NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`role` text NOT NULL,
	`email` text NOT NULL,
	`hashed_password` text,
	`email_verified` integer DEFAULT false,
	`created_at` integer DEFAULT 1757947949121 NOT NULL,
	`updated_at` integer DEFAULT 1757947949121 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `users_to_projects` (
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);

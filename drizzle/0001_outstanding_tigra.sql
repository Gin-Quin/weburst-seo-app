CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`client_name` text NOT NULL,
	`domain` text NOT NULL,
	`website_url` text NOT NULL,
	`type` text NOT NULL,
	`keyword_analysis_per_month` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`role` text NOT NULL,
	`email` text NOT NULL,
	`project_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
DROP TABLE `user`;
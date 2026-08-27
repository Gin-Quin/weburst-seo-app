CREATE TABLE `client_context_files` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `client_context_files_client_id_idx` ON `client_context_files` (`client_id`);--> statement-breakpoint
ALTER TABLE `clients` ADD `context` text DEFAULT '' NOT NULL;

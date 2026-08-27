CREATE TABLE `__new_client_context_files` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_client_context_files` (`id`, `client_id`, `name`, `mime_type`, `size`, `content`, `created_at`)
SELECT `id`, `client_id`, `name`, `mime_type`, `size`,
	CASE WHEN lower(`name`) LIKE '%.pdf' THEN '' ELSE CAST(`data` AS TEXT) END,
	`created_at`
FROM `client_context_files`;
--> statement-breakpoint
DROP TABLE `client_context_files`;
--> statement-breakpoint
ALTER TABLE `__new_client_context_files` RENAME TO `client_context_files`;
--> statement-breakpoint
CREATE INDEX `client_context_files_client_id_idx` ON `client_context_files` (`client_id`);

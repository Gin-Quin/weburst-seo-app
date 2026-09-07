CREATE TABLE `content_typologies` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `content_typologies_client_idx` ON `content_typologies` (`client_id`);--> statement-breakpoint
ALTER TABLE `contents` ADD `typology_id` text REFERENCES content_typologies(id) ON DELETE SET NULL;

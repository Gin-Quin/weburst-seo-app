CREATE TABLE `content_chats` (
	`content_id` text NOT NULL,
	`user_id` text NOT NULL,
	`messages_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`content_id`, `user_id`),
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `content_chats_user_id_idx` ON `content_chats` (`user_id`);

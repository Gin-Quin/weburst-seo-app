CREATE TABLE `content_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`content_id` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`brief` text NOT NULL,
	`content_html` text NOT NULL,
	`content_text` text NOT NULL,
	`content_json` text NOT NULL,
	`score` real,
	`serpmantics_guide_json` text,
	`serpmantics_analysis_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `content_versions_content_id_idx` ON `content_versions` (`content_id`);--> statement-breakpoint
CREATE INDEX `content_versions_content_version_idx` ON `content_versions` (`content_id`,`version`);--> statement-breakpoint
CREATE TABLE `contents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`cluster` text,
	`priority` text,
	`existing_url` text,
	`brief` text DEFAULT '' NOT NULL,
	`content_html` text DEFAULT '' NOT NULL,
	`content_text` text DEFAULT '' NOT NULL,
	`content_json` text DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`serpmantics_guide_id` text,
	`serpmantics_status` text DEFAULT 'pending' NOT NULL,
	`serpmantics_error` text,
	`serpmantics_guide_json` text,
	`serpmantics_analysis_json` text,
	`score` real,
	`chat_messages_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contents_project_id_idx` ON `contents` (`project_id`);--> statement-breakpoint
CREATE INDEX `contents_project_archived_idx` ON `contents` (`project_id`,`archived_at`);

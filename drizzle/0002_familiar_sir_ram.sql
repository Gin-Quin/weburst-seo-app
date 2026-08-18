CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
ALTER TABLE `projects` ADD `client_id` text REFERENCES `clients`(`id`);
--> statement-breakpoint
INSERT INTO `clients` (`id`, `name`, `created_at`, `updated_at`)
SELECT
	lower(hex(randomblob(16))),
	min(trim(`client_name`)),
	cast((julianday('now') - 2440587.5) * 86400000 AS integer),
	cast((julianday('now') - 2440587.5) * 86400000 AS integer)
FROM `projects`
GROUP BY lower(trim(`client_name`));
--> statement-breakpoint
UPDATE `projects`
SET `client_id` = (
	SELECT `clients`.`id`
	FROM `clients`
	WHERE lower(trim(`clients`.`name`)) = lower(trim(`projects`.`client_name`))
	ORDER BY `clients`.`id`
	LIMIT 1
);
--> statement-breakpoint
CREATE INDEX `projects_client_id_idx` ON `projects` (`client_id`);
--> statement-breakpoint
CREATE TABLE `users_to_clients` (
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	PRIMARY KEY (`user_id`, `client_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT OR IGNORE INTO `users_to_clients` (`user_id`, `client_id`)
SELECT `users_to_projects`.`user_id`, `projects`.`client_id`
FROM `users_to_projects`
INNER JOIN `projects` ON `projects`.`id` = `users_to_projects`.`project_id`
WHERE `projects`.`client_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `users_to_clients_client_id_idx` ON `users_to_clients` (`client_id`);
--> statement-breakpoint
UPDATE `users` SET `role` = 'project_manager' WHERE `role` = 'user';
--> statement-breakpoint
UPDATE `deleted_users` SET `role` = 'project_manager' WHERE `role` = 'user';

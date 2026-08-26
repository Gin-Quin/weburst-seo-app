ALTER TABLE `projects` ADD `name` text NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE `projects`
SET `name` = COALESCE(NULLIF(trim(`client_name`), ''), `domain`);

ALTER TABLE `projects` ALTER COLUMN "keyword_analysis_frequency" TO "keyword_analysis_frequency" text;
--> statement-breakpoint
UPDATE `projects`
SET `type` = 'audit'
WHERE `type` = 'prospect';
--> statement-breakpoint
UPDATE `projects`
SET `keyword_analysis_frequency` = NULL
WHERE `type` = 'audit';

ALTER TABLE `deleted_users` ADD `client_invitation_emails_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `client_invitation_emails_enabled` integer DEFAULT true NOT NULL;

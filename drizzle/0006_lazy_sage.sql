CREATE TABLE `verification_challenges` (
	`user_id` text PRIMARY KEY NOT NULL,
	`sid` text DEFAULT '' NOT NULL,
	`channel` text NOT NULL,
	`user_version` integer NOT NULL,
	`expires` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed` integer DEFAULT 0 NOT NULL,
	`sends` integer NOT NULL,
	`window_start` integer NOT NULL,
	`last_sent` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verification_sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_version` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `workspace_users` ADD `phone` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `workspace_users` ADD `mobile` text DEFAULT '' NOT NULL;
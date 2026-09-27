CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`data` text NOT NULL,
	`updated` text NOT NULL
);

CREATE TABLE `adhoc_products` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`quote_id` text NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`cost` integer NOT NULL,
	`price` integer NOT NULL,
	`qty` integer NOT NULL,
	`image_key` text,
	`image_type` text,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_adhoc_quote_owner` ON `adhoc_products` (`quote_id`,`owner`);
CREATE TABLE `eway_test_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`quote_version` integer NOT NULL,
	`amount` integer NOT NULL,
	`invoice` text NOT NULL,
	`connection` text NOT NULL,
	`status` text NOT NULL,
	`access_code` text,
	`payment_url` text,
	`transaction_id` text,
	`response_code` text,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_eway_test_quote_version` ON `eway_test_payments` (`quote_id`,`quote_version`);
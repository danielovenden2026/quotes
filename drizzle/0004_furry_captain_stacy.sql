ALTER TABLE `adhoc_products` ADD `source_sku` text;--> statement-breakpoint
ALTER TABLE `adhoc_products` ADD `cost_from_feed` integer DEFAULT 0 NOT NULL;
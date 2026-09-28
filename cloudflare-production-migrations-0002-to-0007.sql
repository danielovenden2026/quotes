-- Verdex Quotes v129 production upgrade
-- Assumes migrations 0000 and 0001 (quotes table + index) are already applied.

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
CREATE INDEX `idx_adhoc_quote_owner` ON `adhoc_products` (`quote_id`,`owner`);

ALTER TABLE `adhoc_products` ADD `images_json` text;
ALTER TABLE `adhoc_products` ADD `family_id` text;

ALTER TABLE `adhoc_products` ADD `source_sku` text;
ALTER TABLE `adhoc_products` ADD `cost_from_feed` integer DEFAULT 0 NOT NULL;

CREATE TABLE `workspace_users` (
  `email` text PRIMARY KEY NOT NULL,
  `user_id` text,
  `name` text NOT NULL,
  `permissions` text NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `updated` text NOT NULL,
  `updated_by` text NOT NULL
);
CREATE UNIQUE INDEX `workspace_users_user_id_unique` ON `workspace_users` (`user_id`);

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
CREATE TABLE `verification_sessions` (
  `hash` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `user_version` integer NOT NULL,
  `expires` integer NOT NULL
);
ALTER TABLE `workspace_users` ADD `phone` text DEFAULT '' NOT NULL;
ALTER TABLE `workspace_users` ADD `mobile` text DEFAULT '' NOT NULL;

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
CREATE UNIQUE INDEX `idx_eway_test_quote_version` ON `eway_test_payments` (`quote_id`,`quote_version`);

ALTER TABLE `workspace_users` ADD `password_hash` text DEFAULT '' NOT NULL;
ALTER TABLE `workspace_users` ADD `password_salt` text DEFAULT '' NOT NULL;
ALTER TABLE `workspace_users` ADD `password_iterations` integer DEFAULT 0 NOT NULL;
CREATE TABLE `workspace_sessions` (`hash` text PRIMARY KEY NOT NULL,`user_id` text NOT NULL,`user_version` integer NOT NULL,`expires` integer NOT NULL,`created` integer NOT NULL);
CREATE INDEX `idx_workspace_sessions_user` ON `workspace_sessions` (`user_id`);
CREATE INDEX `idx_workspace_sessions_expiry` ON `workspace_sessions` (`expires`);
CREATE TABLE `auth_login_attempts` (`email` text PRIMARY KEY NOT NULL,`attempts` integer DEFAULT 0 NOT NULL,`window_start` integer NOT NULL,`locked_until` integer DEFAULT 0 NOT NULL);

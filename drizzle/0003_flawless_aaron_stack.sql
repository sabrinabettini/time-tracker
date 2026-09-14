CREATE TABLE `billing_rates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`hourly_rate_cents` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_billing_rates_name` ON `billing_rates` (`name`);--> statement-breakpoint
ALTER TABLE `time_entries` ADD `rate_name` text DEFAULT 'Legacy rate' NOT NULL;--> statement-breakpoint
ALTER TABLE `time_entries` ADD `billing_rate_id` integer;
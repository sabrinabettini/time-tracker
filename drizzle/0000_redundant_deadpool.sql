CREATE TABLE `time_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task` text NOT NULL,
	`client` text NOT NULL,
	`hourly_rate_cents` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`duration_minutes` integer,
	`status` text DEFAULT 'running' NOT NULL,
	`commit_url` text,
	`screenshot_url` text,
	`notes` text,
	`created_at` text NOT NULL
);

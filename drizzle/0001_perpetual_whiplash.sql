CREATE INDEX `idx_time_entries_started_at` ON `time_entries` (`started_at`);--> statement-breakpoint
CREATE INDEX `idx_time_entries_client_started_at` ON `time_entries` (`client`,`started_at`);
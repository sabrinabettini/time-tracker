CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT 'Sabrina' NOT NULL,
	`initials` text DEFAULT 'SB' NOT NULL,
	`default_rate_cents` integer DEFAULT 15000 NOT NULL,
	`currency` text DEFAULT 'AUD' NOT NULL,
	`timezone` text DEFAULT 'Australia/Sydney' NOT NULL,
	`week_starts_on` integer DEFAULT 1 NOT NULL
);

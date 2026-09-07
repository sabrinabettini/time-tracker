import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const timeEntries = sqliteTable(
  'time_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    task: text('task').notNull(),
    client: text('client').notNull(),
    hourlyRateCents: integer('hourly_rate_cents').notNull().default(0),
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at'),
    durationMinutes: integer('duration_minutes'),
    status: text('status', { enum: ['running', 'completed'] }).notNull().default('running'),
    commitUrl: text('commit_url'),
    screenshotUrl: text('screenshot_url'),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_time_entries_started_at').on(table.startedAt),
    index('idx_time_entries_client_started_at').on(table.client, table.startedAt),
  ],
);

export const appSettings = sqliteTable('app_settings', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull().default('Sabrina'),
  initials: text('initials').notNull().default('SB'),
  defaultRateCents: integer('default_rate_cents').notNull().default(15000),
  currency: text('currency').notNull().default('AUD'),
  timezone: text('timezone').notNull().default('Australia/Sydney'),
  weekStartsOn: integer('week_starts_on').notNull().default(1),
});

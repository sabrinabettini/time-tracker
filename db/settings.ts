import { env } from 'cloudflare:workers';

export type AppSettings = {
  displayName: string;
  initials: string;
  defaultRateCents: number;
  currency: string;
  timezone: string;
  weekStartsOn: number;
};

const defaults: AppSettings = {
  displayName: 'Sabrina',
  initials: 'SB',
  defaultRateCents: 15000,
  currency: 'AUD',
  timezone: 'Australia/Sydney',
  weekStartsOn: 1,
};

async function ensureSettingsTable() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL DEFAULT 'Sabrina',
    initials TEXT NOT NULL DEFAULT 'SB',
    default_rate_cents INTEGER NOT NULL DEFAULT 15000,
    currency TEXT NOT NULL DEFAULT 'AUD',
    timezone TEXT NOT NULL DEFAULT 'Australia/Sydney',
    week_starts_on INTEGER NOT NULL DEFAULT 1
  )`).run();
}

function mapSettings(row: Record<string, unknown>): AppSettings {
  return {
    displayName: String(row.display_name),
    initials: String(row.initials),
    defaultRateCents: Number(row.default_rate_cents),
    currency: String(row.currency),
    timezone: String(row.timezone),
    weekStartsOn: Number(row.week_starts_on),
  };
}

export async function getAppSettings() {
  await ensureSettingsTable();
  await env.DB.prepare(`INSERT OR IGNORE INTO app_settings (id, display_name, initials, default_rate_cents, currency, timezone, week_starts_on)
    VALUES ('default', ?, ?, ?, ?, ?, ?)`).bind(defaults.displayName, defaults.initials, defaults.defaultRateCents, defaults.currency, defaults.timezone, defaults.weekStartsOn).run();
  const row = await env.DB.prepare("SELECT * FROM app_settings WHERE id = 'default'").first<Record<string, unknown>>();
  return row ? mapSettings(row) : defaults;
}

export async function saveAppSettings(settings: AppSettings) {
  await ensureSettingsTable();
  await env.DB.prepare(`INSERT INTO app_settings (id, display_name, initials, default_rate_cents, currency, timezone, week_starts_on)
    VALUES ('default', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, initials = excluded.initials,
    default_rate_cents = excluded.default_rate_cents, currency = excluded.currency,
    timezone = excluded.timezone, week_starts_on = excluded.week_starts_on`)
    .bind(settings.displayName, settings.initials, settings.defaultRateCents, settings.currency, settings.timezone, settings.weekStartsOn)
    .run();
  return getAppSettings();
}

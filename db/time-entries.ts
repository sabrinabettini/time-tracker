import { env } from 'cloudflare:workers';

export type TimeEntry = {
  id: number;
  task: string;
  client: string;
  hourlyRateCents: number;
  rateName: string;
  billingRateId: number | null;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  status: 'running' | 'completed';
  commitUrl: string | null;
  screenshotUrl: string | null;
  notes: string | null;
  createdAt: string;
};

export async function ensureTimeEntriesTable() {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task TEXT NOT NULL,
      client TEXT NOT NULL,
      hourly_rate_cents INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_minutes INTEGER,
      status TEXT NOT NULL DEFAULT 'running',
      commit_url TEXT,
      screenshot_url TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_time_entries_started_at ON time_entries (started_at)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_time_entries_client_started_at ON time_entries (client, started_at)'),
  ]);
}

function mapRow(row: Record<string, unknown>): TimeEntry {
  return {
    id: Number(row.id),
    task: String(row.task),
    client: String(row.client),
    hourlyRateCents: Number(row.hourly_rate_cents),
    rateName: String(row.rate_name ?? 'Legacy rate'),
    billingRateId: row.billing_rate_id == null ? null : Number(row.billing_rate_id),
    startedAt: String(row.started_at),
    endedAt: row.ended_at ? String(row.ended_at) : null,
    durationMinutes: row.duration_minutes == null ? null : Number(row.duration_minutes),
    status: row.status === 'completed' ? 'completed' : 'running',
    commitUrl: row.commit_url ? String(row.commit_url) : null,
    screenshotUrl: row.screenshot_url ? String(row.screenshot_url) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
  };
}

export async function listTimeEntries(): Promise<TimeEntry[]> {
  await ensureTimeEntriesTable();
  const result = await env.DB.prepare('SELECT * FROM time_entries ORDER BY started_at DESC LIMIT 200').all();
  return (result.results as Record<string, unknown>[]).map(mapRow);
}

export async function startTimeEntry(task: string, client: string, billingRateId: number, rateName: string, hourlyRateCents: number) {
  await ensureTimeEntriesTable();
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `INSERT INTO time_entries (task, client, billing_rate_id, rate_name, hourly_rate_cents, started_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'running', ?) RETURNING *`,
  ).bind(task, client, billingRateId, rateName, hourlyRateCents, now, now).first<Record<string, unknown>>();
  if (!result) throw new Error('Unable to start timer');
  return mapRow(result);
}

export async function stopTimeEntry(id: number, commitUrl: string, screenshotUrl: string, notes: string) {
  await ensureTimeEntriesTable();
  const existing = await env.DB.prepare('SELECT started_at FROM time_entries WHERE id = ? AND status = ?')
    .bind(id, 'running').first<{ started_at: string }>();
  if (!existing) throw new Error('Running entry not found');
  const endedAt = new Date();
  const minutes = Math.max(1, Math.round((endedAt.getTime() - new Date(existing.started_at).getTime()) / 60000));
  const result = await env.DB.prepare(
    `UPDATE time_entries SET ended_at = ?, duration_minutes = ?, status = 'completed', commit_url = ?, screenshot_url = ?, notes = ?
     WHERE id = ? RETURNING *`,
  ).bind(endedAt.toISOString(), minutes, commitUrl || null, screenshotUrl || null, notes || null, id).first<Record<string, unknown>>();
  if (!result) throw new Error('Unable to stop timer');
  return mapRow(result);
}

export async function addManualTimeEntry(input: {
  task: string;
  client: string;
  hourlyRateCents: number;
  rateName: string;
  billingRateId: number;
  startedAt: string;
  endedAt: string;
  commitUrl: string;
  screenshotUrl: string;
  notes: string;
}) {
  await ensureTimeEntriesTable();
  const start = new Date(input.startedAt);
  const end = new Date(input.endedAt);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
    throw new Error('End time must be after start time and within 24 hours.');
  }
  if (end.getTime() > Date.now() + 60000) {
    throw new Error('Past work cannot end in the future.');
  }
  const createdAt = new Date().toISOString();
  const result = await env.DB.prepare(
    `INSERT INTO time_entries (task, client, billing_rate_id, rate_name, hourly_rate_cents, started_at, ended_at, duration_minutes, status, commit_url, screenshot_url, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?) RETURNING *`,
  ).bind(input.task, input.client, input.billingRateId, input.rateName, input.hourlyRateCents, start.toISOString(), end.toISOString(), minutes, input.commitUrl || null, input.screenshotUrl || null, input.notes || null, createdAt).first<Record<string, unknown>>();
  if (!result) throw new Error('Unable to add past work');
  return mapRow(result);
}

export async function updateTimeEntry(id: number, input: {
  task: string;
  client: string;
  hourlyRateCents: number;
  rateName: string;
  billingRateId: number;
  commitUrl: string;
  screenshotUrl: string;
  notes: string;
}) {
  await ensureTimeEntriesTable();
  const result = await env.DB.prepare(
    `UPDATE time_entries SET task = ?, client = ?, billing_rate_id = ?, rate_name = ?, hourly_rate_cents = ?, commit_url = ?, screenshot_url = ?, notes = ?
     WHERE id = ? AND status = 'completed' RETURNING *`,
  ).bind(input.task, input.client, input.billingRateId, input.rateName, input.hourlyRateCents, input.commitUrl || null, input.screenshotUrl || null, input.notes || null, id).first<Record<string, unknown>>();
  if (!result) throw new Error('Completed entry not found.');
  return mapRow(result);
}

export type ImportedTimeEntry = {
  task: string;
  client: string;
  hourlyRateCents: number;
  startedAt: string;
  endedAt: string;
  commitUrl: string;
  screenshotUrl: string;
  notes: string;
};

export async function importTimeEntries(inputs: ImportedTimeEntry[]) {
  if (!inputs.length) throw new Error('There are no entries to import.');
  if (inputs.length > 100) throw new Error('Import up to 100 entries at a time.');
  await ensureTimeEntriesTable();
  const createdAt = new Date().toISOString();
  const statements = inputs.map((input) => {
    const start = new Date(input.startedAt);
    const end = new Date(input.endedAt);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    if (!input.task || !input.client || !Number.isFinite(input.hourlyRateCents) || input.hourlyRateCents < 0) throw new Error('Each imported entry needs a task, client and valid rate.');
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) throw new Error('Each imported entry needs an end time within 24 hours of its start time.');
    if (end.getTime() > Date.now() + 60000) throw new Error('Imported work cannot end in the future.');
    return env.DB.prepare(
      `INSERT INTO time_entries (task, client, hourly_rate_cents, started_at, ended_at, duration_minutes, status, commit_url, screenshot_url, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?) RETURNING *`,
    ).bind(input.task, input.client, input.hourlyRateCents, start.toISOString(), end.toISOString(), minutes, input.commitUrl || null, input.screenshotUrl || null, input.notes || null, createdAt);
  });
  const results = await env.DB.batch(statements);
  return results.map((result) => mapRow(result.results[0] as Record<string, unknown>));
}

export async function deleteTimeEntry(id: number) {
  await ensureTimeEntriesTable();
  const result = await env.DB.prepare('DELETE FROM time_entries WHERE id = ? RETURNING id')
    .bind(id)
    .first<{ id: number }>();
  if (!result) throw new Error('Time entry not found');
  return result.id;
}

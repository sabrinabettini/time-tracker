import { env } from 'cloudflare:workers';

export type TimeEntry = {
  id: number;
  task: string;
  client: string;
  hourlyRateCents: number;
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

export async function startTimeEntry(task: string, client: string, hourlyRateCents: number) {
  await ensureTimeEntriesTable();
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `INSERT INTO time_entries (task, client, hourly_rate_cents, started_at, status, created_at)
     VALUES (?, ?, ?, ?, 'running', ?) RETURNING *`,
  ).bind(task, client, hourlyRateCents, now, now).first<Record<string, unknown>>();
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
    `INSERT INTO time_entries (task, client, hourly_rate_cents, started_at, ended_at, duration_minutes, status, commit_url, screenshot_url, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?) RETURNING *`,
  ).bind(input.task, input.client, input.hourlyRateCents, start.toISOString(), end.toISOString(), minutes, input.commitUrl || null, input.screenshotUrl || null, input.notes || null, createdAt).first<Record<string, unknown>>();
  if (!result) throw new Error('Unable to add past work');
  return mapRow(result);
}

export async function deleteTimeEntry(id: number) {
  await ensureTimeEntriesTable();
  const result = await env.DB.prepare('DELETE FROM time_entries WHERE id = ? RETURNING id')
    .bind(id)
    .first<{ id: number }>();
  if (!result) throw new Error('Time entry not found');
  return result.id;
}

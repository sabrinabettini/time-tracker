import { env } from 'cloudflare:workers';

export type BillingRate = {
  id: number;
  name: string;
  description: string;
  hourlyRateCents: number;
  createdAt: string;
};

function mapRate(row: Record<string, unknown>): BillingRate {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: String(row.description ?? ''),
    hourlyRateCents: Number(row.hourly_rate_cents),
    createdAt: String(row.created_at),
  };
}

export async function listBillingRates(): Promise<BillingRate[]> {
  const result = await env.DB.prepare('SELECT * FROM billing_rates ORDER BY name COLLATE NOCASE').all();
  return (result.results as Record<string, unknown>[]).map(mapRate);
}

export async function createBillingRate(name: string, description: string, hourlyRateCents: number) {
  const createdAt = new Date().toISOString();
  const result = await env.DB.prepare(
    `INSERT INTO billing_rates (name, description, hourly_rate_cents, created_at)
     VALUES (?, ?, ?, ?) RETURNING *`,
  ).bind(name, description, hourlyRateCents, createdAt).first<Record<string, unknown>>();
  if (!result) throw new Error('Unable to create rate.');
  return mapRate(result);
}

export async function getBillingRate(id: number) {
  const result = await env.DB.prepare('SELECT * FROM billing_rates WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!result) throw new Error('Billing rate not found.');
  return mapRate(result);
}

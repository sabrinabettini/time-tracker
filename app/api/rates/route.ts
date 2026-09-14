import { createBillingRate, listBillingRates } from '@/db/billing-rates';

export async function GET() {
  try {
    return Response.json({ rates: await listBillingRates() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to load rates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const name = String(body.name ?? '').trim();
    const description = String(body.description ?? '').trim();
    const fee = Number(body.hourlyRate ?? 0);
    if (!name || !Number.isFinite(fee) || fee < 0) {
      return Response.json({ error: 'A rate name and valid hourly fee are required.' }, { status: 400 });
    }
    return Response.json({ rate: await createBillingRate(name, description, Math.round(fee * 100)) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to create rate' }, { status: 500 });
  }
}

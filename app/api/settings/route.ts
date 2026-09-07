import { getAppSettings, saveAppSettings } from '@/db/settings';

export async function GET() {
  try {
    return Response.json({ settings: await getAppSettings() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to load settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const displayName = String(body.displayName ?? '').trim();
    const initials = String(body.initials ?? '').trim().toUpperCase().slice(0, 3);
    const defaultRate = Number(body.defaultRate ?? 0);
    if (!displayName || !initials || !Number.isFinite(defaultRate) || defaultRate < 0) {
      return Response.json({ error: 'Name, initials and a valid rate are required.' }, { status: 400 });
    }
    const settings = await saveAppSettings({
      displayName,
      initials,
      defaultRateCents: Math.round(defaultRate * 100),
      currency: 'AUD',
      timezone: 'Australia/Sydney',
      weekStartsOn: 1,
    });
    return Response.json({ settings });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to save settings' }, { status: 500 });
  }
}

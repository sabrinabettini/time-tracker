import { addManualTimeEntry, deleteTimeEntry, listTimeEntries, startTimeEntry, stopTimeEntry } from '@/db/time-entries';

export async function GET() {
  try {
    return Response.json({ entries: await listTimeEntries() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to load entries' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === 'start') {
      const task = String(body.task ?? '').trim();
      const client = String(body.client ?? '').trim();
      const rate = Number(body.hourlyRate ?? 0);
      if (!task || !client || !Number.isFinite(rate) || rate < 0) {
        return Response.json({ error: 'Task, client and a valid rate are required.' }, { status: 400 });
      }
      return Response.json({ entry: await startTimeEntry(task, client, Math.round(rate * 100)) }, { status: 201 });
    }
    if (body.action === 'stop') {
      const id = Number(body.id);
      if (!Number.isInteger(id)) return Response.json({ error: 'A valid entry is required.' }, { status: 400 });
      return Response.json({ entry: await stopTimeEntry(id, String(body.commitUrl ?? '').trim(), String(body.screenshotUrl ?? '').trim(), String(body.notes ?? '').trim()) });
    }
    if (body.action === 'manual') {
      const task = String(body.task ?? '').trim();
      const client = String(body.client ?? '').trim();
      const rate = Number(body.hourlyRate ?? 0);
      if (!task || !client || !Number.isFinite(rate) || rate < 0) {
        return Response.json({ error: 'Task, client and a valid rate are required.' }, { status: 400 });
      }
      return Response.json({
        entry: await addManualTimeEntry({
          task,
          client,
          hourlyRateCents: Math.round(rate * 100),
          startedAt: String(body.startedAt ?? ''),
          endedAt: String(body.endedAt ?? ''),
          commitUrl: String(body.commitUrl ?? '').trim(),
          screenshotUrl: String(body.screenshotUrl ?? '').trim(),
          notes: String(body.notes ?? '').trim(),
        }),
      }, { status: 201 });
    }
    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to save entry' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!Number.isInteger(id)) {
      return Response.json({ error: 'A valid entry is required.' }, { status: 400 });
    }
    return Response.json({ deletedId: await deleteTimeEntry(id) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to delete entry' }, { status: 500 });
  }
}

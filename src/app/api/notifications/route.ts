import { check, db, maybe, must } from '@/lib/server/db';
import { fail, handle, json, readJson } from '@/lib/server/http';
import { deviceId, requireMember } from '@/lib/server/identity';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireMember();
  const device = await deviceId();
  const [items, read] = await Promise.all([
    db().from('notices').select('id,kind,ref,title,body,actor,created_at').order('created_at', { ascending: false }).limit(60),
    device ? db().from('notice_reads').select('read_at').eq('device_id', device).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  return json({ items: must(items), readAt: (maybe(read) as { read_at: string } | null)?.read_at ?? null });
});

// Marks everything up to now as read on this device.
export const POST = handle(async (req: Request) => {
  await requireMember();
  await readJson(req);
  const device = await deviceId();
  if (!device) fail('Choose your name first.', 401);
  check(await db().from('notice_reads').upsert({ device_id: device, read_at: new Date().toISOString() }));
  return json({ ok: true });
});

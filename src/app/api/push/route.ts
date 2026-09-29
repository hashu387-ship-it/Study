import { check, db } from '@/lib/server/db';
import { fail, handle, json, readJson } from '@/lib/server/http';
import { deviceId, requireMember } from '@/lib/server/identity';
import { allowedPushEndpoint, pushConfigured } from '@/lib/server/notify';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? '', configured: pushConfigured() }));

export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const device = await deviceId();
  if (!device) fail('Choose your name first.', 401);
  const sub = await readJson<{ endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }>(req, 10_000);
  if (
    typeof sub.endpoint !== 'string' ||
    !allowedPushEndpoint(sub.endpoint) ||
    typeof sub.keys?.p256dh !== 'string' ||
    typeof sub.keys?.auth !== 'string' ||
    !/^[A-Za-z0-9_-]{80,100}$/.test(sub.keys.p256dh) ||
    !/^[A-Za-z0-9_-]{16,32}$/.test(sub.keys.auth)
  ) {
    fail('This browser returned a push subscription we could not use.');
  }
  check(
    await db().from('push_subscriptions').upsert({
      endpoint: sub.endpoint,
      device_id: device,
      member_id: me.memberId,
      subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
    }),
  );
  return json({ ok: true });
});

export const DELETE = handle(async (req: Request) => {
  const device = await deviceId();
  const body = await readJson(req);
  if (!device || typeof body.endpoint !== 'string') fail('Nothing to turn off.');
  check(await db().from('push_subscriptions').delete().eq('endpoint', body.endpoint).eq('device_id', device));
  return json({ ok: true });
});

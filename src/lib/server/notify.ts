import 'server-only';
import webpush from 'web-push';
import { db, must } from './db';

type Notice = { kind: string; ref: string; title: string; body: string; actor: string | null; url: string };

let configured: boolean | null = null;

function pushReady() {
  if (configured === null) {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    configured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
    if (configured) webpush.setVapidDetails(VAPID_SUBJECT!, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
  }
  return configured;
}

export function pushConfigured() {
  return pushReady();
}

// Only well-known browser push services, so a stored subscription can't make the server call anywhere else.
export function allowedPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    const host = url.hostname;
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (host === 'fcm.googleapis.com' ||
        host === 'updates.push.services.mozilla.com' ||
        host.endsWith('.push.services.mozilla.com') ||
        host === 'web.push.apple.com' ||
        host.endsWith('.push.apple.com') ||
        host.endsWith('.notify.windows.com'))
    );
  } catch {
    return false;
  }
}

type Target = { exceptMember?: string | null; onlyMembers?: string[] };

export async function sendPush(payload: { title: string; body: string; url: string; tag: string }, target: Target = {}) {
  if (!pushReady()) return 0;
  let query = db().from('push_subscriptions').select('endpoint,member_id,subscription').limit(500);
  if (target.onlyMembers) {
    if (!target.onlyMembers.length) return 0;
    query = query.in('member_id', target.onlyMembers);
  }
  const subs = must(await query) as { endpoint: string; member_id: string | null; subscription: webpush.PushSubscription }[];
  const recipients = subs.filter(
    (s) => allowedPushEndpoint(s.endpoint) && (!target.exceptMember || s.member_id !== target.exceptMember),
  );
  const message = JSON.stringify(payload);
  let delivered = 0;
  await Promise.allSettled(
    recipients.map(async (s) => {
      try {
        await webpush.sendNotification(s.subscription, message, { TTL: 60 * 60 * 24, timeout: 8000 });
        delivered++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db().from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        } else {
          console.warn('Push delivery failed', status);
        }
      }
    }),
  );
  return delivered;
}

// Records group activity for the in-app feed and pushes it to everyone else's devices.
export async function notify(notice: Notice) {
  const row = must(
    await db()
      .from('notices')
      .insert({ kind: notice.kind, ref: notice.ref, title: notice.title, body: notice.body.slice(0, 300), actor: notice.actor })
      .select('id')
      .single(),
  );
  try {
    await sendPush(
      { title: notice.title, body: notice.body.slice(0, 180), url: notice.url, tag: row.id },
      { exceptMember: notice.actor },
    );
  } catch (error) {
    console.warn('Push fan-out failed', error);
  }
}

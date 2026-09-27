import { db, must } from '@/lib/server/db';
import { fail, handle, json } from '@/lib/server/http';
import { fmtTime, ZONES } from '@/lib/time';
import { sendPush } from '@/lib/server/notify';

export const dynamic = 'force-dynamic';

// Called every few minutes by a Supabase pg_cron job. Sends one push per session when its reminder is due.
export const GET = handle(async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) fail('Not allowed.', 401);

  const now = Date.now();
  const due = must(
    await db()
      .from('sessions')
      .select('id,title,starts_at,reminder_minutes')
      .eq('status', 'Planned')
      .is('reminded_at', null)
      .not('starts_at', 'is', null)
      // A little slack after the start so "at start time" reminders still go out if a run is late.
      .gt('starts_at', new Date(now - 10 * 60_000).toISOString())
      .lte('starts_at', new Date(now + 24 * 60 * 60 * 1000 + 60_000).toISOString()),
  ) as { id: string; title: string; starts_at: string; reminder_minutes: number }[];

  let sent = 0;
  for (const s of due) {
    const start = Date.parse(s.starts_at);
    if (start - s.reminder_minutes * 60_000 > now) continue;
    // Claim the reminder first so overlapping runs can't send it twice.
    const claimed = must(
      await db().from('sessions').update({ reminded_at: new Date().toISOString() }).eq('id', s.id).is('reminded_at', null).select('id'),
    );
    if (!claimed.length) continue;
    const minutes = Math.max(0, Math.round((start - now) / 60_000));
    const times = ZONES.map((z) => `${z.label} ${fmtTime(s.starts_at, z.tz)}`).join(' · ');
    const body = minutes >= 90 ? `Starts at ${times}.` : minutes > 0 ? `Starts in ${minutes} minutes (${times}).` : `Starting now (${times}).`;
    await sendPush({ title: s.title, body, url: '/?view=calendar', tag: `session-${s.id}` });
    sent++;
  }
  return json({ checked: due.length, sent });
});

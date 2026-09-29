import { check, db } from '@/lib/server/db';
import { fail, handle, json, readJson, str } from '@/lib/server/http';
import { requireMember } from '@/lib/server/identity';
import { notify } from '@/lib/server/notify';

export const dynamic = 'force-dynamic';

// The group's one meeting link (Teams or similar), used for every session. Anyone can set it.
export const PATCH = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  const url = str(body.meeting_url, 'the meeting link', 2000);
  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      fail('Paste the full meeting link, starting with https://');
    }
    if (parsed.protocol !== 'https:') fail('Paste the full meeting link, starting with https://');
  }
  check(
    await db()
      .from('settings')
      .upsert({ key: 'meeting_url', value: url, updated_by: me.memberId, updated_at: new Date().toISOString() }),
  );
  if (url) {
    await notify({
      kind: 'session',
      ref: '',
      title: `${me.name} set the meeting link`,
      body: 'One link now works for every session. Find it on Home and in the calendar.',
      actor: me.memberId,
      url: '/?view=calendar',
    });
  }
  return json({ ok: true });
});

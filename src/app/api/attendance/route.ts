import { check, db, maybe } from '@/lib/server/db';
import { fail, handle, json, oneOf, readJson, uuid } from '@/lib/server/http';
import { requireMember } from '@/lib/server/identity';
import { ATTENDANCE_STATUSES } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Anyone can mark anyone. A null status clears the mark.
export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  const sessionId = uuid(body.sessionId, 'session');
  if (typeof body.memberId !== 'string') fail('Choose a member.');
  const [session, member] = await Promise.all([
    db().from('sessions').select('id').eq('id', sessionId).maybeSingle(),
    db().from('members').select('id').eq('id', body.memberId).maybeSingle(),
  ]);
  if (!maybe(session)) fail('That session could not be found.', 404);
  if (!maybe(member)) fail('That member could not be found.', 404);

  if (body.status === null) {
    check(await db().from('attendance').delete().eq('session_id', sessionId).eq('member_id', body.memberId));
  } else {
    const status = oneOf(body.status, ATTENDANCE_STATUSES, 'attendance mark');
    check(
      await db().from('attendance').upsert({
        session_id: sessionId,
        member_id: body.memberId,
        status,
        marked_by: me.memberId,
        marked_at: new Date().toISOString(),
      }),
    );
  }
  return json({ ok: true });
});

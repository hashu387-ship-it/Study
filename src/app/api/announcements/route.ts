import { check, db, maybe, must } from '@/lib/server/db';
import { fail, handle, json, readJson, str, uuid } from '@/lib/server/http';
import { requireMember } from '@/lib/server/identity';
import { notify, sendPush } from '@/lib/server/notify';

export const dynamic = 'force-dynamic';

// action: "post" (default) creates an announcement, "seen" marks some as seen by me,
// "nudge" re-sends one to everyone who hasn't opened it yet.
export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);

  if (body.action === 'seen') {
    if (!Array.isArray(body.ids) || body.ids.length > 50) fail('Nothing to mark as seen.');
    const ids = body.ids.map((id) => uuid(id, 'announcement'));
    if (ids.length) {
      check(
        await db()
          .from('announcement_reads')
          .upsert(ids.map((id) => ({ announcement_id: id, member_id: me.memberId })), { ignoreDuplicates: true }),
      );
    }
    return json({ ok: true });
  }

  if (body.action === 'nudge') {
    const id = uuid(body.id, 'announcement');
    const announcement = maybe(await db().from('announcements').select('title,body').eq('id', id).maybeSingle());
    if (!announcement) fail('That announcement has been removed.', 404);
    const [members, reads] = await Promise.all([
      db().from('members').select('id').eq('status', 'Active'),
      db().from('announcement_reads').select('member_id').eq('announcement_id', id),
    ]);
    const seen = new Set((must(reads) as { member_id: string }[]).map((r) => r.member_id));
    const pending = (must(members) as { id: string }[]).map((m) => m.id).filter((m) => !seen.has(m) && m !== me.memberId);
    const delivered = await sendPush(
      { title: `Reminder: ${announcement.title}`, body: announcement.body.slice(0, 180), url: '/?view=announcements', tag: `nudge-${id}` },
      { onlyMembers: pending },
    );
    return json({ pending: pending.length, delivered });
  }

  const title = str(body.title, 'a title', 200, { required: true });
  const text = str(body.body, 'the message', 10000, { required: true });
  const row = must(
    await db().from('announcements').insert({ member_id: me.memberId, title, body: text }).select('id').single(),
  );
  check(await db().from('announcement_reads').insert({ announcement_id: row.id, member_id: me.memberId }));
  await notify({
    kind: 'announcement',
    ref: row.id,
    title: `Announcement: ${title}`,
    body: text,
    actor: me.memberId,
    url: '/?view=announcements',
  });
  return json({ id: row.id }, 201);
});

export const DELETE = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  const id = uuid(body.id, 'announcement');
  const row = maybe(await db().from('announcements').select('member_id').eq('id', id).maybeSingle());
  if (!row) fail('That announcement has already been removed.', 404);
  if (row.member_id !== me.memberId && !me.isLeader) fail('Only the person who posted this can remove it.', 403);
  check(await db().from('announcements').delete().eq('id', id));
  return json({ ok: true });
});

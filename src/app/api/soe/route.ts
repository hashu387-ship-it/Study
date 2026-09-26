import { db, maybe, must } from '@/lib/server/db';
import { fail, handle, json, oneOf, readJson, str } from '@/lib/server/http';
import { requireMember } from '@/lib/server/identity';

export const dynamic = 'force-dynamic';

// Members add competencies for themselves; the group leader can add them for anyone.
export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  const memberId = typeof body.member_id === 'string' ? body.member_id : me.memberId;
  if (memberId !== me.memberId && !me.isLeader) fail('You can add competencies for yourself only.', 403);
  const competency = str(body.competency, 'a competency', 120, { required: true });
  const type = oneOf(body.competency_type ?? 'Technical', ['Mandatory', 'Optional', 'Technical'] as const, 'competency type');
  const member = maybe(await db().from('members').select('id').eq('id', memberId).maybeSingle());
  if (!member) fail('That member could not be found.', 404);
  const existing = must(
    await db().from('soe').select('id').eq('member_id', memberId).ilike('competency', competency.replace(/[%_\\]/g, '\\$&')),
  );
  if (existing.length) fail('This competency is already in the register for that member.', 409);
  const row = must(
    await db()
      .from('soe')
      .insert({ member_id: memberId, competency, competency_type: type, updated_by: me.memberId })
      .select('id')
      .single(),
  );
  return json({ id: row.id }, 201);
});

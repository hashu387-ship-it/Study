import { check, db, must } from '@/lib/server/db';
import { fail, handle, json, oneOf, readJson, revisionOf, STALE, str } from '@/lib/server/http';
import { requireMember } from '@/lib/server/identity';
import { PATHWAYS } from '@/lib/types';

export const dynamic = 'force-dynamic';

function fields(body: Record<string, unknown>) {
  return {
    name: str(body.name, 'a name', 80, { required: true }),
    pathway: oneOf(body.pathway ?? PATHWAYS[0], PATHWAYS, 'pathway'),
    notes: str(body.notes, 'notes', 2000),
    status: oneOf(body.status ?? 'Active', ['Active', 'Inactive'] as const, 'status'),
  };
}

// Everyone in the group can add members; each new member gets a case study record.
export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  const values = fields(body);
  const existing = must(await db().from('members').select('id,sort')) as { id: string; sort: number }[];
  const next = Math.max(0, ...existing.map((m) => Number(m.id.slice(1)) || 0)) + 1;
  const id = 'M' + String(next).padStart(2, '0');
  const sort = Math.max(0, ...existing.map((m) => m.sort)) + 1;
  check(await db().from('members').insert({ id, ...values, sort, updated_by: me.memberId }));
  check(await db().from('case_studies').insert({ member_id: id, updated_by: me.memberId }));
  return json({ id }, 201);
});

export const PATCH = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  if (typeof body.id !== 'string') fail('That member could not be found.', 404);
  const revision = revisionOf(body.revision);
  const updated = must(
    await db()
      .from('members')
      .update({ ...fields(body), revision: revision + 1, updated_by: me.memberId, updated_at: new Date().toISOString() })
      .eq('id', body.id)
      .eq('revision', revision)
      .select('id'),
  );
  if (!updated.length) fail(STALE, 409);
  return json({ ok: true });
});

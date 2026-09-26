import { db, maybe, must } from '@/lib/server/db';
import { fail, handle, json, oneOf, readJson, revisionOf, STALE, str, uuid } from '@/lib/server/http';
import { requireMember } from '@/lib/server/identity';
import { REVIEW_STATUSES } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Adds another practice question to a competency (the workbook starts each one with three).
export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  const soeId = uuid(body.soe_id, 'SOE record');
  const rows = must(await db().from('qa').select('number').eq('soe_id', soeId)) as { number: number }[];
  const soe = maybe(await db().from('soe').select('id').eq('id', soeId).maybeSingle());
  if (!soe) fail('That SOE record could not be found.', 404);
  const number = Math.max(0, ...rows.map((r) => r.number)) + 1;
  if (number > 20) fail('A competency can have up to 20 practice questions.');
  const row = must(
    await db().from('qa').insert({ soe_id: soeId, number, updated_by: me.memberId }).select('id').single(),
  );
  return json({ id: row.id }, 201);
});

export const PATCH = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  const id = uuid(body.id, 'question');
  const revision = revisionOf(body.revision);
  const updated = must(
    await db()
      .from('qa')
      .update({
        question: str(body.question, 'the question', 4000),
        context: str(body.context, 'context', 8000),
        action: str(body.action, 'professional action', 8000),
        basis: str(body.basis, 'RICS / contract basis', 8000),
        outcome: str(body.outcome, 'outcome', 8000),
        feedback: str(body.feedback, 'feedback', 8000),
        status: oneOf(body.status, REVIEW_STATUSES, 'status'),
        revision: revision + 1,
        updated_by: me.memberId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('revision', revision)
      .select('id'),
  );
  if (!updated.length) fail(STALE, 409);
  return json({ ok: true });
});

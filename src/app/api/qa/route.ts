import { db, maybe, must } from '@/lib/server/db';
import { fail, handle, json, oneOf, readJson, revisionOf, STALE, str, uuid } from '@/lib/server/http';
import { requireMember } from '@/lib/server/identity';
import { REVIEW_STATUSES } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function soeFor(soeId: string) {
  const soe = maybe(await db().from('soe').select('member_id,questioner_id').eq('id', soeId).maybeSingle()) as {
    member_id: string;
    questioner_id: string | null;
  } | null;
  if (!soe) fail('That SOE record could not be found.', 404);
  return soe;
}

// The assigned questioner adds another practice question (the workbook starts each competency with three).
export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  const soeId = uuid(body.soe_id, 'SOE record');
  const soe = await soeFor(soeId);
  if (soe.questioner_id !== me.memberId) fail('Only the assigned questioner can add questions.', 403);
  const rows = must(await db().from('qa').select('number').eq('soe_id', soeId)) as { number: number }[];
  const number = Math.max(0, ...rows.map((r) => r.number)) + 1;
  if (number > 20) fail('A competency can have up to 20 practice questions.');
  const row = must(
    await db().from('qa').insert({ soe_id: soeId, number, updated_by: me.memberId }).select('id').single(),
  );
  return json({ id: row.id }, 201);
});

// The questioner writes the question, the candidate writes the answer, and anyone can add feedback.
export const PATCH = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  const id = uuid(body.id, 'question');
  const revision = revisionOf(body.revision);
  const qa = maybe(await db().from('qa').select('soe_id').eq('id', id).maybeSingle()) as { soe_id: string } | null;
  if (!qa) fail('That question could not be found.', 404);
  const soe = await soeFor(qa.soe_id);
  const isQuestioner = soe.questioner_id === me.memberId;
  const isCandidate = soe.member_id === me.memberId;

  const update: Record<string, unknown> = { feedback: str(body.feedback, 'feedback', 8000) };
  if (isQuestioner) update.question = str(body.question, 'the question', 4000);
  if (isCandidate) {
    Object.assign(update, {
      context: str(body.context, 'context', 8000),
      action: str(body.action, 'professional action', 8000),
      basis: str(body.basis, 'RICS / contract basis', 8000),
      outcome: str(body.outcome, 'outcome', 8000),
    });
  }
  if (isQuestioner || isCandidate) update.status = oneOf(body.status, REVIEW_STATUSES, 'status');

  const updated = must(
    await db()
      .from('qa')
      .update({ ...update, revision: revision + 1, updated_by: me.memberId, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('revision', revision)
      .select('id'),
  );
  if (!updated.length) fail(STALE, 409);
  return json({ ok: true });
});

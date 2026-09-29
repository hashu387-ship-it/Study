import { check, db, maybe, must } from '@/lib/server/db';
import { fail, handle, json, oneOf, readJson, revisionOf, STALE, str, uuid } from '@/lib/server/http';
import { requireMember } from '@/lib/server/identity';
import { sendPush } from '@/lib/server/notify';
import { REVIEW_STATUSES } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Soe = { id: string; member_id: string; competency: string; submitted_at: string | null };

async function soeFor(soeId: string) {
  const soe = maybe(
    await db().from('soe').select('id,member_id,competency,submitted_at').eq('id', soeId).maybeSingle(),
  ) as Soe | null;
  if (!soe) fail('That SOE record could not be found.', 404);
  return soe;
}

// Records the activity for the feed and pushes it to one person.
async function tell(to: string, notice: { kind: string; ref: string; title: string; body: string; actor: string }) {
  check(await db().from('notices').insert({ ...notice, body: notice.body.slice(0, 300) }));
  try {
    await sendPush({ title: notice.title, body: notice.body.slice(0, 180), url: `/?view=soe&record=${notice.ref}`, tag: `${notice.kind}-${notice.ref}` }, { onlyMembers: [to] });
  } catch (error) {
    console.warn('Push failed', error);
  }
}

// Once an SOE is submitted, every other candidate asks one question on each level.
export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  const soe = await soeFor(uuid(body.soe_id, 'SOE record'));
  if (soe.member_id === me.memberId) fail('Others ask the questions on your SOE; you answer them.', 403);
  if (!soe.submitted_at) fail('You can ask questions once this SOE has been submitted.');
  const level = Number(body.level);
  if (![1, 2, 3].includes(level)) fail('Choose Level 1, 2 or 3.');
  const question = str(body.question, 'your question', 4000, { required: true });
  const already = `You have already asked your Level ${level} question here. You can edit it instead.`;
  // Two people can ask at the same moment; if the question number is taken, count again and retry.
  let row: { id: string } | null = null;
  for (let attempt = 0; attempt < 3 && !row; attempt++) {
    const rows = must(await db().from('qa').select('number,level,asked_by').eq('soe_id', soe.id)) as { number: number; level: number | null; asked_by: string | null }[];
    if (rows.some((r) => r.asked_by === me.memberId && r.level === level)) fail(already, 409);
    const number = Math.max(0, ...rows.map((r) => r.number)) + 1;
    if (number > 100) fail('This SOE has reached the question limit.');
    const result = await db()
      .from('qa')
      .insert({ soe_id: soe.id, number, level, question, asked_by: me.memberId, updated_by: me.memberId })
      .select('id')
      .single();
    if (result.error?.code === '23505') {
      if (result.error.message.includes('qa_one_per_level')) fail(already, 409);
      continue;
    }
    row = must(result);
  }
  if (!row) fail('Lots of questions arrived at once. Please send yours again.', 409);
  await tell(soe.member_id, {
    kind: 'question',
    ref: soe.id,
    title: `${me.name} asked you a Level ${level} question`,
    body: `${soe.competency}: ${question}`,
    actor: me.memberId,
  });
  return json({ id: row.id }, 201);
});

// The person who asked edits the question, the candidate writes the answer, and anyone can add feedback.
export const PATCH = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  const id = uuid(body.id, 'question');
  const revision = revisionOf(body.revision);
  const qa = maybe(await db().from('qa').select('soe_id,asked_by,context,action,basis,outcome').eq('id', id).maybeSingle()) as {
    soe_id: string;
    asked_by: string | null;
    context: string;
    action: string;
    basis: string;
    outcome: string;
  } | null;
  if (!qa) fail('That question could not be found.', 404);
  const soe = await soeFor(qa.soe_id);
  const isAsker = qa.asked_by === me.memberId;
  const isCandidate = soe.member_id === me.memberId;

  const update: Record<string, unknown> = { feedback: str(body.feedback, 'feedback', 8000) };
  if (isAsker) update.question = str(body.question, 'the question', 4000, { required: true });
  if (isCandidate) {
    Object.assign(update, {
      context: str(body.context, 'context', 8000),
      action: str(body.action, 'professional action', 8000),
      basis: str(body.basis, 'RICS / contract basis', 8000),
      outcome: str(body.outcome, 'outcome', 8000),
    });
  }
  if (isAsker || isCandidate) update.status = oneOf(body.status, REVIEW_STATUSES, 'status');

  const updated = must(
    await db()
      .from('qa')
      .update({ ...update, revision: revision + 1, updated_by: me.memberId, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('revision', revision)
      .select('id'),
  );
  if (!updated.length) fail(STALE, 409);

  const wasUnanswered = ![qa.context, qa.action, qa.basis, qa.outcome].some((t) => t.trim());
  const nowAnswered = isCandidate && ['context', 'action', 'basis', 'outcome'].some((k) => String(update[k] ?? '').trim());
  if (wasUnanswered && nowAnswered && qa.asked_by && qa.asked_by !== me.memberId) {
    await tell(qa.asked_by, {
      kind: 'answer',
      ref: soe.id,
      title: `${me.name} answered your question`,
      body: soe.competency,
      actor: me.memberId,
    });
  }
  return json({ ok: true });
});

export const DELETE = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  const id = uuid(body.id, 'question');
  const qa = maybe(await db().from('qa').select('asked_by').eq('id', id).maybeSingle()) as { asked_by: string | null } | null;
  if (!qa) fail('That question has already been removed.', 404);
  if (qa.asked_by !== me.memberId && !me.isLeader) fail('Only the person who asked can remove this question.', 403);
  check(await db().from('qa').delete().eq('id', id));
  return json({ ok: true });
});

import { db, maybe, must } from '@/lib/server/db';
import { fail, handle, json, oneOf, readJson, revisionOf, STALE, str, uuid } from '@/lib/server/http';
import { requireMember } from '@/lib/server/identity';
import { claimFiles } from '@/lib/server/files';
import { notify } from '@/lib/server/notify';
import { PRESENTATION_STATUSES, REVIEW_STATUSES } from '@/lib/types';

export const dynamic = 'force-dynamic';

// The candidate and the group leader edit the case study and presentation.
// Everyone else can add questions for the candidate.
export const PATCH = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  const id = uuid(body.id, 'case study');
  const revision = revisionOf(body.revision);
  const current = maybe(
    await db().from('case_studies').select('member_id,presentation_status').eq('id', id).maybeSingle(),
  ) as { member_id: string; presentation_status: string } | null;
  if (!current) fail('That case study could not be found.', 404);
  const owner = current.member_id === me.memberId || me.isLeader;

  const update: Record<string, unknown> = { questions: str(body.questions, 'questions', 8000) };
  if (owner) {
    Object.assign(update, {
      title: str(body.title, 'a title', 200),
      summary: str(body.summary, 'the summary', 8000),
      status: oneOf(body.status, REVIEW_STATUSES, 'review status'),
      notes: str(body.notes, 'notes', 4000),
      presentation_status: oneOf(body.presentation_status, PRESENTATION_STATUSES, 'presentation status'),
    });
    if (body.slidesFileId === null) update.slides_file = null;
    else if (body.slidesFileId) update.slides_file = (await claimFiles([body.slidesFileId], 'slides', me.memberId, 1))[0].id;
  }

  const updated = must(
    await db()
      .from('case_studies')
      .update({ ...update, revision: revision + 1, updated_by: me.memberId, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('revision', revision)
      .select('id'),
  );
  if (!updated.length) fail(STALE, 409);

  if (owner && update.presentation_status === 'Ready' && current.presentation_status !== 'Ready') {
    const member = must(await db().from('members').select('name').eq('id', current.member_id).single());
    await notify({
      kind: 'presentation',
      ref: id,
      title: 'Presentation ready',
      body: `${member.name} is ready to present at the workshop.`,
      actor: me.memberId,
      url: '/?view=cases',
    });
  }
  return json({ ok: true });
});

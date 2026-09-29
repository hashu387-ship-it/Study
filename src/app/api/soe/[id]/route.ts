import { check, db, maybe, must } from '@/lib/server/db';
import { assertSameOrigin, fail, handle, json, oneOf, readJson, revisionOf, STALE, str, uuid } from '@/lib/server/http';
import { requireMember } from '@/lib/server/identity';
import { fileRefs } from '@/lib/server/files';
import { REVIEW_STATUSES, type SoeFull } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
const words = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const id = uuid((await params).id);
  const s = maybe(await db().from('soe').select('*').eq('id', id).maybeSingle()) as Record<string, any> | null;
  if (!s) fail('That SOE record could not be found.', 404);
  const files = await fileRefs([s.level1_file, s.level2_file, s.level3_file]);
  const full: SoeFull = {
    id: s.id,
    member_id: s.member_id,
    competency: s.competency,
    competency_type: s.competency_type,
    level1: s.level1,
    level2: s.level2,
    level3: s.level3,
    words: [words(s.level1), words(s.level2), words(s.level3)],
    files: [files.get(s.level1_file) ?? null, files.get(s.level2_file) ?? null, files.get(s.level3_file) ?? null],
    questioner_id: s.questioner_id,
    status: s.status,
    notes: s.notes,
    submitted_at: s.submitted_at,
    submitted_by: s.submitted_by,
    revision: s.revision,
  };
  return json(full);
});

// Record details (competency type, review status, leader notes) are open to the whole group.
// The SOE text itself only changes through /submit, by the candidate.
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireMember();
  const id = uuid((await params).id);
  const body = await readJson(req);
  const revision = revisionOf(body.revision);
  const current = maybe(await db().from('soe').select('member_id').eq('id', id).maybeSingle());
  if (!current) fail('That SOE record could not be found.', 404);
  const updated = must(
    await db()
      .from('soe')
      .update({
        competency_type: oneOf(body.competency_type, ['Mandatory', 'Optional', 'Technical'] as const, 'competency type'),
        status: oneOf(body.status, REVIEW_STATUSES, 'review status'),
        notes: str(body.notes, 'notes', 4000),
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

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  assertSameOrigin(req);
  const me = await requireMember();
  const id = uuid((await params).id);
  const current = maybe(await db().from('soe').select('member_id').eq('id', id).maybeSingle());
  if (!current) fail('That SOE record could not be found.', 404);
  if (current.member_id !== me.memberId && !me.isLeader) fail('Only the candidate or the group leader can remove this.', 403);
  check(await db().from('soe').delete().eq('id', id));
  return json({ ok: true });
});

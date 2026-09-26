import { db, maybe, must } from '@/lib/server/db';
import { fail, handle, json, readJson, revisionOf, STALE, uuid } from '@/lib/server/http';
import { requireMember } from '@/lib/server/identity';
import { claimFiles } from '@/lib/server/files';
import { notify } from '@/lib/server/notify';

export const dynamic = 'force-dynamic';

type Level = { text?: unknown; fileId?: unknown };

// The candidate saves their Level 1-3 SOE text (pasted or converted) plus any original files,
// and the group gets a notification.
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const me = await requireMember();
  const id = uuid((await params).id);
  const body = await readJson<{ revision?: unknown; levels?: unknown }>(req, 150_000);
  const revision = revisionOf(body.revision);
  if (!Array.isArray(body.levels) || body.levels.length !== 3) fail('The SOE levels are missing.');
  const levels = body.levels as Level[];

  const current = maybe(
    await db().from('soe').select('member_id,competency,level1,level2,level3,revision').eq('id', id).maybeSingle(),
  ) as Record<string, any> | null;
  if (!current) fail('That SOE record could not be found.', 404);
  if (current.member_id !== me.memberId) fail('Only the candidate can submit SOE text for this competency.', 403);
  if (current.revision !== revision) fail(STALE, 409);

  const update: Record<string, unknown> = {};
  let changed = false;
  for (let i = 0; i < 3; i++) {
    const key = `level${i + 1}`;
    const text = levels[i]?.text;
    if (typeof text !== 'string') fail(`Level ${i + 1} text is missing.`);
    if (text.length > 30000) fail(`Keep Level ${i + 1} under 30,000 characters.`);
    if (text !== current[key]) {
      update[key] = text;
      changed = true;
    }
    if (levels[i]?.fileId) {
      const [file] = await claimFiles([levels[i].fileId], 'soe', me.memberId, 1);
      update[`${key}_file`] = file.id;
      changed = true;
    }
  }
  if (!changed) fail('Add or change your SOE text before submitting.');

  const now = new Date().toISOString();
  const updated = must(
    await db()
      .from('soe')
      .update({
        ...update,
        submitted_at: now,
        submitted_by: me.name,
        revision: revision + 1,
        updated_by: me.memberId,
        updated_at: now,
      })
      .eq('id', id)
      .eq('revision', revision)
      .select('id'),
  );
  if (!updated.length) fail(STALE, 409);

  await notify({
    kind: 'soe',
    ref: id,
    title: `${me.name} submitted SOE`,
    body: `${current.competency}. Open it to ask a question.`,
    actor: me.memberId,
    url: `/?view=soe&record=${id}`,
  });
  return json({ ok: true });
});

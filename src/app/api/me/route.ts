import { db, maybe, must } from '@/lib/server/db';
import { assertSameOrigin, fail, handle, json, readJson } from '@/lib/server/http';
import { chooseMember, forgetMember } from '@/lib/server/identity';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req: Request) => {
  const { memberId } = await readJson<{ memberId?: unknown }>(req);
  if (typeof memberId !== 'string') fail('Choose your name.');
  const member = maybe(await db().from('members').select('id').eq('id', memberId).maybeSingle());
  if (!member) fail('That member could not be found. Refresh and try again.', 404);
  await chooseMember(memberId);
  return json({ ok: true });
});

export const DELETE = handle(async (req: Request) => {
  assertSameOrigin(req);
  await forgetMember();
  return json({ ok: true });
});

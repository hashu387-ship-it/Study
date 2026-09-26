import { check, db, maybe, must } from '@/lib/server/db';
import { fail, handle, json, readJson, str, uuid } from '@/lib/server/http';
import { requireMember } from '@/lib/server/identity';
import { claimFiles } from '@/lib/server/files';
import { notify } from '@/lib/server/notify';
import type { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

const COLUMNS = 'id,parent_id,member_id,title,body,attachments,created_at';

export const GET = handle(async (req: Request) => {
  const id = new URL(req.url).searchParams.get('id');
  if (id) {
    uuid(id, 'post');
    const post = maybe(await db().from('posts').select(COLUMNS).eq('id', id).is('parent_id', null).maybeSingle());
    if (!post) fail('This post has been removed.', 404);
    const replies = must(
      await db().from('posts').select(COLUMNS).eq('parent_id', id).order('created_at').limit(300),
    );
    return json({ post, replies });
  }
  const posts = must(
    await db().from('posts').select(COLUMNS).is('parent_id', null).order('created_at', { ascending: false }).limit(100),
  ) as Post[];
  const counts = new Map<string, number>();
  if (posts.length) {
    const replies = must(
      await db().from('posts').select('parent_id').in('parent_id', posts.map((p) => p.id)),
    ) as { parent_id: string }[];
    for (const r of replies) counts.set(r.parent_id, (counts.get(r.parent_id) ?? 0) + 1);
  }
  return json(posts.map((p) => ({ ...p, replies: counts.get(p.id) ?? 0 })));
});

// Anyone can post, and anyone (the original poster included) can reply.
export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  const parentId = body.parentId ? uuid(body.parentId, 'post') : null;
  const text = str(body.body, 'a message', 20000, { required: true });
  let title = '';
  let parent: { id: string; title: string; member_id: string } | null = null;
  if (parentId) {
    parent = maybe(await db().from('posts').select('id,title,member_id').eq('id', parentId).is('parent_id', null).maybeSingle());
    if (!parent) fail('This post has been removed.', 404);
  } else {
    title = str(body.title, 'a title', 200, { required: true });
  }
  const attachments = await claimFiles(body.fileIds, 'post', me.memberId, 4);
  const row = must(
    await db()
      .from('posts')
      .insert({ parent_id: parentId, member_id: me.memberId, title, body: text, attachments })
      .select('id')
      .single(),
  );
  const threadId = parentId ?? row.id;
  await notify({
    kind: parentId ? 'reply' : 'post',
    ref: threadId,
    title: parentId ? `${me.name} replied` : `${me.name} posted`,
    body: parentId ? `On "${parent!.title}": ${text}` : `${title}: ${text}`,
    actor: me.memberId,
    url: `/?view=posts&post=${threadId}`,
  });
  return json({ id: row.id, threadId }, 201);
});

export const DELETE = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  const id = uuid(body.id, 'post');
  const post = maybe(await db().from('posts').select('member_id').eq('id', id).maybeSingle());
  if (!post) fail('This post has already been removed.', 404);
  if (post.member_id !== me.memberId && !me.isLeader) fail('Only the person who posted this can remove it.', 403);
  check(await db().from('posts').delete().eq('id', id));
  return json({ ok: true });
});

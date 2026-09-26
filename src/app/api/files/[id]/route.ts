import { BUCKET, db, maybe, must } from '@/lib/server/db';
import { fail, handle, json } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const INLINE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];

// Redirects to a short-lived signed link. Only images and PDFs open in the browser; everything else downloads.
// With ?preview=1 it returns the link instead, so the app can show the file in place.
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) fail('File not found.', 404);
  const file = maybe(
    await db().from('files').select('path,name,content_type,confirmed').eq('id', id).maybeSingle(),
  ) as { path: string; name: string; content_type: string; confirmed: boolean } | null;
  if (!file || !file.confirmed) fail('File not found.', 404);
  const search = new URL(req.url).searchParams;
  if (search.get('preview') === '1') {
    const signed = must(await db().storage.from(BUCKET).createSignedUrl(file.path, 600));
    return json({ url: signed.signedUrl, name: file.name, content_type: file.content_type });
  }
  const inline = search.get('inline') === '1' && INLINE_TYPES.includes(file.content_type);
  const signed = must(
    await db().storage.from(BUCKET).createSignedUrl(file.path, 300, inline ? undefined : { download: file.name }),
  );
  return new Response(null, {
    status: 302,
    headers: { Location: signed.signedUrl, 'Cache-Control': 'private, max-age=240' },
  });
});

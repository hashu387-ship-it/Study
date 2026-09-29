import { BUCKET, check, db, must } from '@/lib/server/db';
import { fail, handle, json, oneOf, readJson } from '@/lib/server/http';
import { requireMember } from '@/lib/server/identity';
import { fileExtension, UPLOAD_CONTEXTS, UPLOAD_TYPES, type UploadContext } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Hands the browser a one-time upload link so files go straight to storage.
export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  const context = oneOf(body.context, Object.keys(UPLOAD_CONTEXTS) as UploadContext[], 'upload type');
  const rules = UPLOAD_CONTEXTS[context];
  if (typeof body.name !== 'string' || !body.name.trim()) fail('The file needs a name.');
  const name = body.name.trim().slice(0, 200);
  const ext = fileExtension(name);
  if (!(rules.types as readonly string[]).includes(ext)) fail(`Use one of these file types: ${rules.types.join(', ').toUpperCase()}.`);
  const size = Number(body.size);
  if (!Number.isInteger(size) || size <= 0) fail('That file is empty.');
  if (size > rules.maxBytes) fail(`Keep files under ${Math.round(rules.maxBytes / 1024 / 1024)} MB.`, 413);

  const id = crypto.randomUUID();
  const path = `${context}/${id}`;
  const contentType = UPLOAD_TYPES[ext];
  check(
    await db().from('files').insert({ id, path, name, content_type: contentType, size, context, uploaded_by: me.memberId }),
  );
  const signed = must(await db().storage.from(BUCKET).createSignedUploadUrl(path));
  return json({ id, uploadUrl: signed.signedUrl, contentType }, 201);
});

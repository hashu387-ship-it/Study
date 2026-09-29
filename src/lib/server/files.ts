import 'server-only';
import { BUCKET, check, db, must } from './db';
import { fail } from './http';
import type { FileRef, UploadContext } from '@/lib/types';

// Checks that uploaded files exist in storage, belong to the expected context, and marks them as used.
export async function claimFiles(ids: unknown, context: UploadContext, memberId: string, max: number): Promise<FileRef[]> {
  if (ids === undefined || ids === null) return [];
  if (!Array.isArray(ids) || ids.length > max || ids.some((id) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) {
    fail('One of the attachments could not be found.');
  }
  if (!ids.length) return [];
  const rows = must(
    await db().from('files').select('id,path,name,content_type,size,context,uploaded_by').in('id', ids as string[]),
  ) as { id: string; path: string; name: string; content_type: string; size: number; context: string; uploaded_by: string }[];
  if (rows.length !== ids.length || rows.some((r) => r.context !== context || r.uploaded_by !== memberId)) {
    fail('One of the attachments could not be found. Try attaching it again.');
  }
  for (const row of rows) {
    const folder = row.path.slice(0, row.path.lastIndexOf('/'));
    const listed = must(await db().storage.from(BUCKET).list(folder, { search: row.path.slice(folder.length + 1) }));
    if (!listed.length) fail(`"${row.name}" did not finish uploading. Try attaching it again.`);
  }
  check(await db().from('files').update({ confirmed: true }).in('id', ids as string[]));
  const order = new Map((ids as string[]).map((id, i) => [id, i]));
  return rows
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!)
    .map(({ id, name, content_type, size }) => ({ id, name, content_type, size }));
}

export async function fileRefs(ids: (string | null)[]) {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!wanted.length) return new Map<string, FileRef>();
  const rows = must(await db().from('files').select('id,name,content_type,size').in('id', wanted)) as FileRef[];
  return new Map(rows.map((r) => [r.id, r]));
}

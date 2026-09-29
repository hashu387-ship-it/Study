import { fileExtension, UPLOAD_CONTEXTS, type UploadContext } from '@/lib/types';

export async function api<T = { ok: true }>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
    });
  } catch {
    throw new Error('You seem to be offline. Check your connection and try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || 'Something went wrong. Please try again.');
  return data as T;
}

export function checkFile(file: File, context: UploadContext) {
  const rules = UPLOAD_CONTEXTS[context];
  if (!(rules.types as readonly string[]).includes(fileExtension(file.name))) {
    return `"${file.name}" isn't a supported file. Use ${rules.types.join(', ').toUpperCase()}.`;
  }
  if (file.size > rules.maxBytes) return `"${file.name}" is over ${Math.round(rules.maxBytes / 1024 / 1024)} MB.`;
  if (!file.size) return `"${file.name}" is empty.`;
  return null;
}

// Gets a one-time upload link from the server, then sends the file straight to storage.
export async function uploadFile(file: File, context: UploadContext): Promise<string> {
  const problem = checkFile(file, context);
  if (problem) throw new Error(problem);
  const { id, uploadUrl, contentType } = await api<{ id: string; uploadUrl: string; contentType: string }>('/api/uploads', {
    body: { context, name: file.name, size: file.size },
  });
  let response: Response;
  try {
    response = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType, 'x-upsert': 'false' }, body: file });
  } catch {
    throw new Error(`"${file.name}" couldn't upload. Check your connection and try again.`);
  }
  if (!response.ok) throw new Error(`"${file.name}" couldn't upload. Please try again.`);
  return id;
}

export function fileUrl(id: string, inline = false) {
  return `/api/files/${id}${inline ? '?inline=1' : ''}`;
}

export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

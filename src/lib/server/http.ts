import 'server-only';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function fail(message: string, status = 400): never {
  throw new HttpError(status, message);
}

// Wraps a route handler: turns HttpError into a JSON error and hides anything unexpected.
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error(error);
      return json({ error: 'Something went wrong. Please try again.' }, 503);
    }
  };
}

// Blocks cross-site form posts. Browsers always send Origin on fetch POST/PATCH/DELETE.
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (new URL(origin).host !== host) fail('This request came from another site.', 403);
}

export async function readJson<T = Record<string, unknown>>(req: Request, maxBytes = 200_000): Promise<T> {
  assertSameOrigin(req);
  const text = await req.text();
  if (text.length > maxBytes) fail('That is too much text to save at once.', 413);
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as T;
  } catch {
    fail('The request could not be read.');
  }
}

export function str(value: unknown, label: string, max: number, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) fail(`Enter ${label}.`);
    return '';
  }
  if (typeof value !== 'string') fail(`${label} must be text.`);
  const trimmed = value.trim();
  if (required && !trimmed) fail(`Enter ${label}.`);
  if (trimmed.length > max) fail(`Keep ${label} under ${max.toLocaleString()} characters.`);
  return trimmed;
}

export function oneOf<T extends string>(value: unknown, options: readonly T[], label: string): T {
  if (typeof value !== 'string' || !options.includes(value as T)) fail(`Choose a valid ${label}.`);
  return value as T;
}

export function revisionOf(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) fail('The record version is missing.');
  return value;
}

export function uuid(value: unknown, label = 'record') {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) fail(`That ${label} could not be found.`, 404);
  return value;
}

export const STALE = 'Someone else saved this a moment ago. Close it, then open it again to see their changes.';

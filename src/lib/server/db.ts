import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const BUCKET = 'group-files';

let client: SupabaseClient | null = null;

// Every request carries x-app-key; the database's row level security rejects anything without it.
export function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    const appKey = process.env.APP_KEY;
    if (!url || !key || !appKey) throw new Error('Supabase environment variables are missing.');
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { 'x-app-key': appKey } },
    });
  }
  return client;
}

type Result = { data: unknown; error: { message: string } | null };
type Data<R> = R extends { data: infer D } ? D : never;

// Throws on a Supabase error so route handlers can use one try/catch.
export function must<R extends Result>(result: R): NonNullable<Data<R>> {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null || result.data === undefined) throw new Error('The database returned no data.');
  return result.data as NonNullable<Data<R>>;
}

// For writes that don't return rows.
export function check(result: Result) {
  if (result.error) throw new Error(result.error.message);
}

// For lookups that may legitimately find nothing (maybeSingle).
export function maybe<R extends Result>(result: R): Data<R> | null {
  if (result.error) throw new Error(result.error.message);
  return result.data as Data<R> | null;
}

import { check, db, maybe, must } from '@/lib/server/db';
import { fail, handle, json, oneOf, readJson, revisionOf, STALE, str, uuid } from '@/lib/server/http';
import { requireMember } from '@/lib/server/identity';
import { notify } from '@/lib/server/notify';

export const dynamic = 'force-dynamic';

const KINDS = ['study', 'qa', 'workshop', 'case', 'mock', 'other'] as const;
const STATUSES = ['Planned', 'Completed', 'Cancelled'] as const;
const REMINDERS = [0, 15, 30, 60, 1440];

function instant(value: unknown, label: string) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) fail(`Check the ${label}.`);
  return new Date(value).toISOString();
}

function fields(body: Record<string, unknown>) {
  const sessionDate = str(body.session_date, 'a date', 10, { required: true });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate) || Number.isNaN(Date.parse(sessionDate))) fail('Enter a valid date.');
  const startsAt = instant(body.starts_at, 'start time');
  const endsAt = instant(body.ends_at, 'end time');
  if (startsAt && endsAt && endsAt <= startsAt) fail('The end time must be after the start time.');
  const hours = body.hours === null || body.hours === undefined || body.hours === '' ? null : Number(body.hours);
  if (hours !== null && (!Number.isFinite(hours) || hours <= 0 || hours > 24)) fail('Hours must be between 0 and 24.');
  const reminder = Number(body.reminder_minutes ?? 30);
  if (!REMINDERS.includes(reminder)) fail('Choose a valid reminder.');
  return {
    title: str(body.title, 'a session title', 200, { required: true }),
    kind: oneOf(body.kind ?? 'study', KINDS, 'session type'),
    session_date: sessionDate,
    starts_at: startsAt,
    ends_at: endsAt,
    hours,
    notes: str(body.notes, 'notes', 4000),
    reminder_minutes: reminder,
    status: oneOf(body.status ?? 'Planned', STATUSES, 'status'),
  };
}

const niceDate = (date: string) =>
  new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const values = fields(await readJson(req));
  const row = must(await db().from('sessions').insert({ ...values, updated_by: me.memberId }).select('id').single());
  await notify({
    kind: 'session',
    ref: row.id,
    title: `${me.name} added a session`,
    body: `${values.title} · ${niceDate(values.session_date)}`,
    actor: me.memberId,
    url: '/?view=calendar',
  });
  return json({ id: row.id }, 201);
});

export const PATCH = handle(async (req: Request) => {
  const me = await requireMember();
  const body = await readJson(req);
  const id = uuid(body.id, 'session');
  const revision = revisionOf(body.revision);
  const values = fields(body);
  const previous = maybe(await db().from('sessions').select('starts_at,reminder_minutes').eq('id', id).maybeSingle());
  if (!previous) fail('That session could not be found.', 404);
  // A new time or reminder means the reminder should go out again.
  const sameStart = (previous.starts_at ? Date.parse(previous.starts_at) : null) === (values.starts_at ? Date.parse(values.starts_at) : null);
  const resetReminder = !sameStart || previous.reminder_minutes !== values.reminder_minutes;
  const updated = must(
    await db()
      .from('sessions')
      .update({
        ...values,
        ...(resetReminder ? { reminded_at: null } : {}),
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

export const DELETE = handle(async (req: Request) => {
  await requireMember();
  const body = await readJson(req);
  const id = uuid(body.id, 'session');
  check(await db().from('sessions').delete().eq('id', id));
  return json({ ok: true });
});

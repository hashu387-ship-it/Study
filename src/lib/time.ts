// Sessions are planned in UAE / Oman time. Each person sees their own local time,
// with the group time alongside when the two differ.

export const GROUP_TZ = 'Asia/Dubai';
export const GROUP_LABEL = 'GST';

export function localTz() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || GROUP_TZ;
  } catch {
    return GROUP_TZ;
  }
}

function offsetMinutes(tz: string, at: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  return Math.round((asUtc - at.getTime()) / 60000);
}

export function sameAsGroup(at = new Date()) {
  return offsetMinutes(localTz(), at) === offsetMinutes(GROUP_TZ, at);
}

export function fmtTime(iso: string, tz?: string) {
  return new Date(iso)
    .toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz })
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// "7:00 – 8:00 pm", keeping am/pm on both ends only when they differ.
function range(start: string | null, end: string | null, tz?: string) {
  if (start && end) {
    const a = fmtTime(start, tz);
    const b = fmtTime(end, tz);
    const sameHalf = a.slice(-2) === b.slice(-2);
    return `${sameHalf ? a.slice(0, -3) : a} – ${b}`;
  }
  if (start) return fmtTime(start, tz);
  if (end) return `until ${fmtTime(end, tz)}`;
  return '';
}

// "7:00 – 8:00 pm your time" plus "8:00 – 9:00 pm GST" when the zones differ.
export function sessionTimes(s: { starts_at: string | null; ends_at: string | null }) {
  const at = s.starts_at ?? s.ends_at;
  if (!at) return null;
  const same = sameAsGroup(new Date(at));
  return {
    local: range(s.starts_at, s.ends_at) + (same ? ` ${GROUP_LABEL}` : ' your time'),
    group: same ? null : `${range(s.starts_at, s.ends_at, GROUP_TZ)} ${GROUP_LABEL}`,
  };
}

export function todayInGroup() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: GROUP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(),
  );
}

// House date style: "Mon 28 Sep", "Monday 28 September". No commas, three-letter months.
export function fmtDate(date: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(date + 'T12:00:00Z')
    .toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' })
    .replace(',', '')
    .replace('Sept', 'Sep');
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

export function ago(iso: string) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Converts a date + wall-clock time in the chosen zone to an ISO instant.
export function toInstant(date: string, time: string, zone: 'group' | 'local') {
  if (!date || !time) return null;
  if (zone === 'group') return new Date(`${date}T${time}:00+04:00`).toISOString();
  return new Date(`${date}T${time}:00`).toISOString();
}

// Wall-clock HH:MM for an instant in the chosen zone.
export function wallTime(iso: string | null, zone: 'group' | 'local') {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: zone === 'group' ? GROUP_TZ : undefined,
  });
}

export function monthLabel(month: string) {
  return new Date(month + '-01T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function shiftMonth(month: string, by: number) {
  const d = new Date(month + '-01T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
}

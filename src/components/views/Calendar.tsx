'use client';

import { Tip } from '../guide';
import { SessionArt } from '../illustrations';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardCheck, Download, Link2, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/client/api';
import { fmtDate, fmtTime, GROUP_LABEL, GROUP_TZ, localTz, monthLabel, shiftMonth, toInstant, todayInGroup, wallTime } from '@/lib/time';
import type { Session } from '@/lib/types';
import { attempt, useHub } from '../hub';
import { Empty, Field, PageHead, Select, Sheet } from '../ui';
import { JoinButton, KIND_LABELS, SessionRow } from './shared';

type Draft = {
  id?: string;
  revision?: number;
  title: string;
  kind: Session['kind'];
  session_date: string;
  start: string;
  end: string;
  zone: 'group' | 'local';
  hours: string;
  reminder_minutes: string;
  status: Session['status'];
  notes: string;
};

function toDraft(s: Session | null, date: string): Draft {
  return {
    id: s?.id,
    revision: s?.revision,
    title: s?.title ?? '',
    kind: s?.kind ?? 'study',
    session_date: s?.session_date ?? date,
    start: wallTime(s?.starts_at ?? null, 'group'),
    end: wallTime(s?.ends_at ?? null, 'group'),
    zone: 'group',
    hours: s?.hours ? String(s.hours) : '',
    reminder_minutes: String(s?.reminder_minutes ?? 30),
    status: s?.status ?? 'Planned',
    notes: s?.notes ?? '',
  };
}

function exportIcs(sessions: Session[], meetingUrl: string) {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RICS Group 03//Study Hub//EN', 'CALSCALE:GREGORIAN'];
  for (const s of sessions) {
    lines.push('BEGIN:VEVENT', `UID:${s.id}@rics-group-03`, `DTSTAMP:${stamp(new Date().toISOString())}`, `SUMMARY:${esc(s.title)}`);
    const description = [s.notes, meetingUrl && `Join: ${meetingUrl}`].filter(Boolean).join('\n\n');
    if (description) lines.push(`DESCRIPTION:${esc(description)}`);
    if (meetingUrl) lines.push(`URL:${meetingUrl}`, `LOCATION:${esc(meetingUrl)}`);
    if (s.starts_at) {
      lines.push(`DTSTART:${stamp(s.starts_at)}`);
      const end = s.ends_at ?? (s.hours ? new Date(Date.parse(s.starts_at) + s.hours * 3600_000).toISOString() : null);
      if (end) lines.push(`DTEND:${stamp(end)}`);
      lines.push('BEGIN:VALARM', `TRIGGER:-PT${s.reminder_minutes || 0}M`, 'ACTION:DISPLAY', `DESCRIPTION:${esc(s.title)}`, 'END:VALARM');
    } else {
      const day = s.session_date.replace(/-/g, '');
      const next = new Date(Date.parse(s.session_date + 'T12:00:00Z') + 86400_000).toISOString().slice(0, 10).replace(/-/g, '');
      lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${next}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'RICS-Group-03-sessions.ics';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

export function Calendar() {
  const hub = useHub();
  const { state, params, go, reload } = hub;
  const today = todayInGroup();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [mode, setMode] = useState<'month' | 'agenda'>('month');
  const [selected, setSelected] = useState(today);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = params.get('session');
    const session = id && state.sessions.find((s) => s.id === id);
    if (session) {
      setMonth(session.session_date.slice(0, 7));
      setSelected(session.session_date);
      setDraft(toDraft(session, session.session_date));
    }
    // Only react to a new deep link, not to background refreshes of the session list.
  }, [params]);

  const byDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of state.sessions) map.set(s.session_date, [...(map.get(s.session_date) ?? []), s]);
    return map;
  }, [state.sessions]);

  const first = new Date(month + '-01T12:00:00Z');
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const monthSessions = state.sessions.filter((s) => s.session_date.startsWith(month));
  const selectedSessions = byDate.get(selected) ?? [];

  function open(session: Session | null, date = selected) {
    setError('');
    setDraft(toDraft(session, date));
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError('');
    try {
      const body = {
        id: draft.id,
        revision: draft.revision,
        title: draft.title,
        kind: draft.kind,
        session_date: draft.session_date,
        starts_at: toInstant(draft.session_date, draft.start, draft.zone),
        ends_at: toInstant(draft.session_date, draft.end, draft.zone),
        hours: draft.hours || null,
        reminder_minutes: Number(draft.reminder_minutes),
        status: draft.status,
        notes: draft.notes,
      };
      await api('/api/sessions', { method: draft.id ? 'PATCH' : 'POST', body });
      await reload();
      hub.toast(draft.id ? 'Session updated.' : 'Session added. The group has been notified.');
      setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function changeZone(zone: 'group' | 'local') {
    if (!draft) return;
    const start = toInstant(draft.session_date, draft.start, draft.zone);
    const end = toInstant(draft.session_date, draft.end, draft.zone);
    setDraft({ ...draft, zone, start: wallTime(start, zone), end: wallTime(end, zone) });
  }

  return (
    <>
      <PageHead
        eyebrow="Study plan"
        title="Calendar"
        text={
          'Every session shows KSA, UAE and Sri Lanka (SL) time, so nobody has to convert.'
        }
        action={
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                const planned = state.sessions.filter((s) => s.status === 'Planned');
                if (!planned.length) return hub.toast('There are no planned sessions to export.', 'error');
                exportIcs(planned, state.meetingUrl);
                hub.toast('Calendar file downloaded. Open it to add the sessions to your phone calendar.');
              }}
            >
              <Download size={17} /> Add to my calendar
            </button>
            <button className="btn primary" onClick={() => open(null, selected >= today ? selected : today)}>
              <Plus size={18} /> Add session
            </button>
          </div>
        }
      />
      <Tip id="calendar" art={SessionArt} title="Every session, one link">
        Sessions run Sunday, Tuesday and Wednesday: KSA 7:00 – 8:30 pm, UAE 8:00 – 9:30 pm, SL 9:30 – 11:00 pm. Tap Join on Teams on the day, or add the sessions to your phone calendar.
      </Tip>

      <MeetingLink />

      <div className="toolbar">
        <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
          <ChevronLeft size={20} />
        </button>
        <h3 style={{ minWidth: 150, textAlign: 'center' }}>{monthLabel(month)}</h3>
        <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
          <ChevronRight size={20} />
        </button>
        <button
          className="btn small"
          onClick={() => {
            setMonth(today.slice(0, 7));
            setSelected(today);
          }}
        >
          Today
        </button>
        <span className="spacer" />
        <div className="segmented" role="group" aria-label="Calendar layout">
          <button aria-pressed={mode === 'month'} onClick={() => setMode('month')}>
            Month
          </button>
          <button aria-pressed={mode === 'agenda'} onClick={() => setMode('agenda')}>
            List
          </button>
        </div>
      </div>

      {mode === 'month' ? (
        <>
          <div className="month" style={{ marginBottom: 24 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="dow">
                {d}
              </div>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <div key={'b' + i} className="day blank" />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = `${month}-${String(i + 1).padStart(2, '0')}`;
              const list = byDate.get(date) ?? [];
              return (
                <div
                  key={date}
                  className={'day' + (date === today ? ' today' : '')}
                  style={date === selected ? { outline: '2px solid var(--blue)', outlineOffset: -2 } : undefined}
                  onClick={() => setSelected(date)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${list.length} sessions`}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(date)}
                >
                  <span className="day-num">{i + 1}</span>
                  {list.map((s) => (
                    <button
                      key={s.id}
                      className={`event ${s.kind} ${s.status === 'Cancelled' ? 'cancelled' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        open(s);
                      }}
                    >
                      {s.starts_at && <b>{fmtTime(s.starts_at, GROUP_TZ)} UAE </b>}
                      {s.title}
                    </button>
                  ))}
                  <span className="dots">
                    {list.slice(0, 3).map((s) => (
                      <i key={s.id} className={s.kind} />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>

          <section className="card">
            <div className="card-head">
              <div>
                <h3>{fmtDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                <p>{selectedSessions.length ? `${selectedSessions.length} session${selectedSessions.length > 1 ? 's' : ''}` : 'Nothing planned'}</p>
              </div>
              <div className="row">
                {selectedSessions.some((s) => s.status === 'Planned') && <JoinButton url={state.meetingUrl} small />}
                <button className="btn small" onClick={() => open(null, selected)}>
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>
            <div className="list">
              {selectedSessions.map((s) => (
                <SessionRow key={s.id} session={s} onClick={() => open(s)} />
              ))}
              {!selectedSessions.length && <Empty>Tap Add to plan a session on this day.</Empty>}
            </div>
          </section>
        </>
      ) : (
        <section className="card">
          <div className="list">
            {monthSessions.map((s) => (
              <SessionRow key={s.id} session={s} onClick={() => open(s)} />
            ))}
            {!monthSessions.length && <Empty>No sessions this month.</Empty>}
          </div>
        </section>
      )}

      <Sheet
        open={!!draft}
        onClose={() => setDraft(null)}
        busy={busy}
        title={draft?.id ? 'Edit session' : 'New session'}
        subtitle="Everyone can plan and update sessions."
        footer={
          draft && (
            <>
              {draft.id && (
                <button
                  className="btn danger"
                  disabled={busy}
                  onClick={() => {
                    if (!confirm('Delete this session and its attendance marks?')) return;
                    attempt(
                      hub,
                      async () => {
                        await api('/api/sessions', { method: 'DELETE', body: { id: draft.id } });
                        await reload();
                        setDraft(null);
                      },
                      'Session deleted.',
                    );
                  }}
                >
                  <Trash2 size={17} /> Delete
                </button>
              )}
              {draft.id && (
                <button className="btn" disabled={busy} onClick={() => go('attendance', { session: draft.id! })}>
                  <ClipboardCheck size={17} /> Attendance
                </button>
              )}
              <span className="spacer" />
              <button className="btn primary" onClick={save} disabled={busy || !draft.title.trim() || !draft.session_date}>
                {busy ? 'Saving…' : 'Save session'}
              </button>
            </>
          )
        }
      >
        {draft && (
          <div className="form">
            <Field label="Title" wide>
              <input value={draft.title} maxLength={200} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="Type">
              <Select
                value={draft.kind}
                onChange={(v) => setDraft({ ...draft, kind: v as Session['kind'] })}
                options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label="Date">
              <input type="date" value={draft.session_date} onChange={(e) => setDraft({ ...draft, session_date: e.target.value })} />
            </Field>
            <Field label="Times entered in" wide hint={draft.zone === 'group' ? 'UTC+4, the time the organiser uses.' : `Your device's time zone (${localTz()}).`}>
              <Select
                value={draft.zone}
                onChange={(v) => changeZone(v as 'group' | 'local')}
                options={[
                  { value: 'group', label: `${GROUP_LABEL} time` },
                  { value: 'local', label: localTz() === GROUP_TZ ? 'My time (same)' : `My time (${localTz()})` },
                ]}
              />
            </Field>
            <Field label="Start time" hint="Leave empty if not confirmed yet.">
              <input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
            </Field>
            <Field label="End time">
              <input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
            </Field>
            <Field label="Planned hours">
              <input type="number" inputMode="decimal" min="0.25" max="24" step="0.25" value={draft.hours} onChange={(e) => setDraft({ ...draft, hours: e.target.value })} />
            </Field>
            <Field label="Reminder" hint="Sent as a phone alert to everyone with alerts on.">
              <Select
                value={draft.reminder_minutes}
                onChange={(v) => setDraft({ ...draft, reminder_minutes: v })}
                options={[
                  { value: '0', label: 'At start time' },
                  { value: '15', label: '15 minutes before' },
                  { value: '30', label: '30 minutes before' },
                  { value: '60', label: '1 hour before' },
                  { value: '1440', label: '1 day before' },
                ]}
              />
            </Field>
            <Field label="Status">
              <Select value={draft.status} onChange={(v) => setDraft({ ...draft, status: v as Session['status'] })} options={['Planned', 'Completed', 'Cancelled']} />
            </Field>
            <Field label="Notes or meeting link" wide>
              <textarea rows={4} value={draft.notes} maxLength={4000} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </Field>
            {error && <p className="error wide">{error}</p>}
          </div>
        )}
      </Sheet>
    </>
  );
}

// One meeting link for every session, set once by anyone in the group.
function MeetingLink() {
  const hub = useHub();
  const { state, reload } = hub;
  const [value, setValue] = useState(state.meetingUrl);
  const [editing, setEditing] = useState(!state.meetingUrl);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const ok = await attempt(
      hub,
      async () => {
        await api('/api/settings', { method: 'PATCH', body: { meeting_url: value.trim() } });
        await reload();
      },
      value.trim() ? 'Meeting link saved for every session.' : 'Meeting link removed.',
    );
    setBusy(false);
    if (ok) setEditing(!value.trim());
  }

  return (
    <section className="card" style={{ marginBottom: 32 }}>
      <div className="card-head" style={{ marginBottom: editing ? 20 : 0 }}>
        <div>
          <div className="eyebrow">Meeting link</div>
          <h3>One link for every session</h3>
          <p>
            {state.meetingUrl
              ? 'Everyone joins every session from the same link, on Home and in the calendar.'
              : 'Create a recurring meeting in Teams, copy its join link, and paste it here.'}
          </p>
        </div>
        {!editing && (
          <div className="row">
            <JoinButton url={state.meetingUrl} small />
            <button className="btn small" onClick={() => setEditing(true)}>
              <Link2 size={16} /> Change
            </button>
          </div>
        )}
      </div>
      {editing && (
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Field label="Join link">
            <input
              type="url"
              inputMode="url"
              placeholder="https://teams.microsoft.com/l/meetup-join/..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
          <button className="btn primary" onClick={save} disabled={busy || value.trim() === state.meetingUrl}>
            {busy ? 'Saving…' : 'Save link'}
          </button>
          {state.meetingUrl && (
            <button className="btn" onClick={() => { setValue(state.meetingUrl); setEditing(false); }} disabled={busy}>
              Cancel
            </button>
          )}
        </div>
      )}
    </section>
  );
}

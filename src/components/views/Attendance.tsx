'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Copy, UserX } from 'lucide-react';
import { api } from '@/lib/client/api';
import { fmtDate, todayInGroup } from '@/lib/time';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '@/lib/types';
import { attempt, useHub } from '../hub';
import { Avatar, Empty, Field, PageHead, Select } from '../ui';
import { SessionWhen } from './shared';

const LABELS: Record<AttendanceStatus, string> = { present: 'Present', late: 'Late', excused: 'Excused', absent: 'Absent' };
const LETTERS: Record<AttendanceStatus, string> = { present: 'P', late: 'L', excused: 'E', absent: 'A' };

export function Attendance() {
  const hub = useHub();
  const { state, me, params, name, reload } = hub;
  const today = todayInGroup();
  const sessions = state.sessions.filter((s) => s.status !== 'Cancelled');

  const defaultSession = useMemo(() => {
    const linked = params.get('session');
    if (linked && sessions.some((s) => s.id === linked)) return linked;
    const past = sessions.filter((s) => s.session_date <= today);
    return (past[past.length - 1] ?? sessions[0])?.id ?? '';
    // Pick once per deep link; later refreshes keep the user's choice.
  }, [params]);

  const [sessionId, setSessionId] = useState(defaultSession);
  const [saving, setSaving] = useState<string | null>(null);
  // Marks shown straight away while they save, so tapping through the list feels instant.
  const [overrides, setOverrides] = useState(new Map<string, AttendanceStatus | null>());
  useEffect(() => setSessionId(defaultSession), [defaultSession]);
  useEffect(() => setOverrides(new Map()), [sessionId]);

  const session = sessions.find((s) => s.id === sessionId);
  const members = state.members.filter((m) => m.status === 'Active');
  const marks = new Map(state.attendance.filter((a) => a.session_id === sessionId).map((a) => [a.member_id, a]));
  for (const [memberId, status] of overrides) {
    if (status === null) marks.delete(memberId);
    else marks.set(memberId, { session_id: sessionId, member_id: memberId, status, marked_by: me.memberId, marked_at: '' });
  }
  const tally = ATTENDANCE_STATUSES.map((status) => ({ status, count: [...marks.values()].filter((m) => m.status === status).length }));
  const unmarked = members.filter((m) => !marks.has(m.id));

  function override(memberId: string, status: AttendanceStatus | null | undefined) {
    setOverrides((current) => {
      const next = new Map(current);
      if (status === undefined) next.delete(memberId);
      else next.set(memberId, status);
      return next;
    });
  }

  async function mark(memberId: string, status: AttendanceStatus | null) {
    setSaving(memberId);
    override(memberId, status);
    await attempt(hub, async () => {
      await api('/api/attendance', { body: { sessionId, memberId, status } });
      await reload();
    });
    override(memberId, undefined);
    setSaving(null);
  }

  function summary() {
    if (!session) return '';
    const group = (statuses: AttendanceStatus[]) =>
      members.filter((m) => statuses.includes(marks.get(m.id)?.status as AttendanceStatus)).map((m) => m.name);
    const present = group(['present', 'late']);
    const excused = group(['excused']);
    const absent = [...group(['absent']), ...unmarked.map((m) => m.name)];
    return [
      `*Attendance: ${session.title}*`,
      fmtDate(session.session_date, { weekday: 'long', day: 'numeric', month: 'long' }),
      '',
      `Attended (${present.length}): ${present.join(', ') || 'none'}`,
      ...(excused.length ? [`Excused (${excused.length}): ${excused.join(', ')}`] : []),
      `Did not attend (${absent.length}): ${absent.join(', ') || 'none'}`,
    ].join('\n');
  }

  // Register: every session with at least one mark.
  const registerSessions = sessions.filter((s) => state.attendance.some((a) => a.session_id === s.id));

  return (
    <>
      <PageHead
        eyebrow="Register"
        title="Attendance"
        text="Mark who attended each session. Anyone in the group can take or correct the register."
      />

      <section className="card" style={{ marginBottom: 22 }}>
        <div className="form" style={{ marginBottom: 18 }}>
          <Field label="Session" wide>
            <Select
              value={sessionId}
              onChange={setSessionId}
              options={sessions.map((s) => ({ value: s.id, label: `${fmtDate(s.session_date)} · ${s.title}` }))}
            />
          </Field>
        </div>

        {session ? (
          <>
            <div className="row" style={{ marginBottom: 14 }}>
              <SessionWhen session={session} />
            </div>
            <div className="row" style={{ marginBottom: 18 }}>
              {tally.map((t) => (
                <span key={t.status} className={'badge ' + (t.status === 'present' ? 'green' : t.status === 'late' ? 'amber' : t.status === 'absent' ? 'red' : '')}>
                  {LABELS[t.status]} {t.count}
                </span>
              ))}
              <span className="badge grey">Not marked {unmarked.length}</span>
            </div>

            <div>
              {members.map((m) => {
                const current = marks.get(m.id);
                return (
                  <div key={m.id} className="att-row">
                    <Avatar member={m} size="sm" />
                    <div>
                      <strong className="small">{m.name} <span className="code">· {m.id}</span></strong>
                      <small>{current ? `Marked by ${name(current.marked_by)}` : 'Not marked yet'}</small>
                    </div>
                    <div className="segmented" role="group" aria-label={`Attendance for ${m.name}`}>
                      {ATTENDANCE_STATUSES.map((status) => (
                        <button
                          key={status}
                          className={status}
                          aria-pressed={current?.status === status}
                          disabled={saving === m.id}
                          onClick={() => mark(m.id, current?.status === status ? null : status)}
                        >
                          {LABELS[status]}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="row" style={{ marginTop: 18 }}>
              {unmarked.length > 0 && (
                <button
                  className="btn small"
                  disabled={saving !== null}
                  onClick={async () => {
                    if (!confirm(`Mark ${unmarked.length} unmarked member${unmarked.length > 1 ? 's' : ''} as absent?`)) return;
                    setSaving('all');
                    unmarked.forEach((m) => override(m.id, 'absent'));
                    await attempt(hub, async () => {
                      await Promise.all(unmarked.map((m) => api('/api/attendance', { body: { sessionId, memberId: m.id, status: 'absent' } })));
                      await reload();
                    });
                    unmarked.forEach((m) => override(m.id, undefined));
                    setSaving(null);
                  }}
                >
                  <UserX size={16} /> Mark the rest absent
                </button>
              )}
              <button className="btn small" onClick={() => attempt(hub, () => navigator.clipboard.writeText(summary()), 'Summary copied. Paste it into WhatsApp.')}>
                <Copy size={16} /> Copy summary for WhatsApp
              </button>
            </div>
          </>
        ) : (
          <Empty icon={<ClipboardCheck size={30} />}>Add a session in the calendar to start a register.</Empty>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h3>Attendance record</h3>
            <p>P present · L late · E excused · A absent. Rate counts present and late.</p>
          </div>
        </div>
        {registerSessions.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  {registerSessions.map((s) => (
                    <th key={s.id} title={s.title}>
                      {fmtDate(s.session_date, { day: 'numeric', month: 'short' })}
                    </th>
                  ))}
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const row = registerSessions.map((s) => state.attendance.find((a) => a.session_id === s.id && a.member_id === m.id));
                  const attended = row.filter((a) => a?.status === 'present' || a?.status === 'late').length;
                  return (
                    <tr key={m.id}>
                      <td>
                        {m.name} <span className="code">· {m.id}</span>
                      </td>
                      {row.map((a, i) => (
                        <td key={registerSessions[i].id}>
                          <span className={'mark ' + (a?.status ?? 'none')} title={a ? LABELS[a.status] : 'Not marked'}>
                            {a ? LETTERS[a.status] : '·'}
                          </span>
                        </td>
                      ))}
                      <td className="strong">{Math.round((attended / registerSessions.length) * 100)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>The record fills in as sessions are marked.</Empty>
        )}
      </section>
    </>
  );
}

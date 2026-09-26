'use client';

import { ArrowRight, BookOpen, CalendarDays, ClipboardCheck, Megaphone, MessageCircleQuestion, Presentation } from 'lucide-react';
import { fmtDate } from '@/lib/time';
import { useHub } from '../hub';
import { Avatar, Empty, PageHead } from '../ui';
import { answered } from './QaPractice';
import { JoinButton, KIND_LABELS, nextWorkshop, SessionRow, SessionWhen, upcomingSessions, WORKSHOP_TARGET } from './shared';

export function Overview() {
  const { state, me, go, member, name } = useHub();
  const upcoming = upcomingSessions(state);
  const next = upcoming[0];
  const workshop = nextWorkshop(state);
  const ready = state.cases.filter((c) => c.presentation_status === 'Ready' || c.presentation_status === 'Presented');
  const soeStarted = state.soe.filter((s) => s.words.some((w) => w > 0)).length;
  const questionsAnswered = state.qa.filter(answered).length;
  const announcement = state.announcements[0];
  const active = state.members.filter((m) => m.status === 'Active');

  const markedSessions = state.sessions.filter((s) => state.attendance.some((a) => a.session_id === s.id));
  const lastMarked = markedSessions[markedSessions.length - 1];
  const lastPresent = lastMarked
    ? state.attendance.filter((a) => a.session_id === lastMarked.id && (a.status === 'present' || a.status === 'late')).length
    : 0;

  const mySoe = state.soe.filter((s) => s.member_id === me.memberId);
  const myMissing = mySoe.filter((s) => s.words.some((w) => w === 0));
  const myCase = state.cases.find((c) => c.member_id === me.memberId);
  const soeIds = new Set(mySoe.map((s) => s.id));
  const myQuestions = state.qa.filter((q) => soeIds.has(q.soe_id) && !answered(q));
  const firstName = me.name.split(' ')[0];

  return (
    <>
      <PageHead
        eyebrow="Group 03 · RICS APC"
        title={`Hello, ${firstName}`}
        text="Your group's evidence, practice and sessions in one place."
      />

      <div className="grid two" style={{ marginBottom: 22 }}>
        {next ? (
          <section className="hero">
            <div className="eyebrow">Next up · {fmtDate(next.session_date, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <h3>{next.title}</h3>
            <div style={{ color: 'inherit' }}>
              <SessionWhen session={next} />
            </div>
            <p>{next.notes || KIND_LABELS[next.kind]}</p>
            <div className="row">
              <JoinButton url={state.meetingUrl} />
              <button className={'btn' + (state.meetingUrl ? '' : ' yellow')} onClick={() => go('calendar')}>
                Open calendar <ArrowRight size={17} />
              </button>
            </div>
          </section>
        ) : (
          <section className="hero">
            <div className="eyebrow">Next up</div>
            <h3>No sessions planned yet</h3>
            <button className="btn yellow" onClick={() => go('calendar')}>
              Add a session <ArrowRight size={17} />
            </button>
          </section>
        )}

        <section className="card">
          <div className="card-head">
            <div>
              <h3>Latest announcement</h3>
              {announcement && (
                <p>
                  {name(announcement.member_id)} · seen by {announcement.seen_by.length} of {active.length}
                </p>
              )}
            </div>
            <Megaphone size={22} className="muted" />
          </div>
          {announcement ? (
            <>
              <strong>{announcement.title}</strong>
              <p className="muted small clamp pre" style={{ marginTop: 6 }}>
                {announcement.body}
              </p>
              <button className="link-btn" style={{ marginTop: 14 }} onClick={() => go('announcements')}>
                Read and mark as seen <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <Empty>No announcements yet.</Empty>
          )}
        </section>
      </div>

      <div className="grid stats" style={{ marginBottom: 22 }}>
        <button className="card stat" onClick={() => go('soe')} style={{ textAlign: 'left' }}>
          <span className="stat-icon">
            <BookOpen size={20} />
          </span>
          <b>
            {soeStarted}/{state.soe.length}
          </b>
          <span>SOE records with evidence</span>
        </button>
        <button className="card stat" onClick={() => go('qa')} style={{ textAlign: 'left' }}>
          <span className="stat-icon">
            <MessageCircleQuestion size={20} />
          </span>
          <b>
            {questionsAnswered}/{state.qa.length}
          </b>
          <span>Group questions answered</span>
        </button>
        <button className="card stat" onClick={() => go('cases')} style={{ textAlign: 'left' }}>
          <span className="stat-icon">
            <Presentation size={20} />
          </span>
          <b>
            {ready.length}/{WORKSHOP_TARGET}
          </b>
          <span>Presentations ready for the workshop</span>
        </button>
        <button className="card stat" onClick={() => go('attendance')} style={{ textAlign: 'left' }}>
          <span className="stat-icon">
            <ClipboardCheck size={20} />
          </span>
          <b>{lastMarked ? `${lastPresent}/${active.length}` : 'None'}</b>
          <span>{lastMarked ? `Attended ${lastMarked.title}` : 'Attendance not taken yet'}</span>
        </button>
      </div>

      <div className="grid two">
        <section className="card">
          <div className="card-head">
            <div>
              <h3>Your to-do</h3>
              <p>Things only you can move forward</p>
            </div>
          </div>
          <div className="list">
            {myMissing.map((s) => (
              <button key={s.id} className="list-item" onClick={() => go('soe', { record: s.id })}>
                <span className="stat-icon" style={{ margin: 0 }}>
                  <BookOpen size={18} />
                </span>
                <div>
                  <strong>{s.competency}</strong>
                  <small>Add your SOE for Level {s.words.map((w, i) => (w ? null : i + 1)).filter(Boolean).join(', ')}</small>
                </div>
                <ArrowRight size={17} />
              </button>
            ))}
            {myCase && myCase.presentation_status !== 'Ready' && myCase.presentation_status !== 'Presented' && (
              <button className="list-item" onClick={() => go('cases', { record: myCase.id })}>
                <span className="stat-icon" style={{ margin: 0 }}>
                  <Presentation size={18} />
                </span>
                <div>
                  <strong>Case study presentation</strong>
                  <small>
                    {workshop
                      ? `Mark it ready for the workshop on ${fmtDate(workshop.session_date)}`
                      : 'Update your presentation status'}
                  </small>
                </div>
                <ArrowRight size={17} />
              </button>
            )}
            {myQuestions.length > 0 && (
              <button className="list-item" onClick={() => go('qa')}>
                <span className="stat-icon" style={{ margin: 0 }}>
                  <MessageCircleQuestion size={18} />
                </span>
                <div>
                  <strong>Answer the group's questions</strong>
                  <small>
                    {myQuestions.length === 1 ? '1 question on your SOE is' : `${myQuestions.length} questions on your SOE are`} waiting for your answer
                  </small>
                </div>
                <ArrowRight size={17} />
              </button>
            )}
            {!myMissing.length && !myQuestions.length && (myCase?.presentation_status === 'Ready' || myCase?.presentation_status === 'Presented') && (
              <Empty>You are all caught up. Nice work.</Empty>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h3>Coming up</h3>
              <p>Times shown in your time zone</p>
            </div>
            <button className="link-btn" onClick={() => go('calendar')}>
              All <CalendarDays size={16} />
            </button>
          </div>
          <div className="list">
            {upcoming.slice(0, 5).map((s) => (
              <SessionRow key={s.id} session={s} onClick={() => go('calendar', { session: s.id })} />
            ))}
            {!upcoming.length && <Empty>No upcoming sessions.</Empty>}
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 22 }}>
        <div className="card-head">
          <div>
            <h3>Your study circle</h3>
            <p>{active.length} members · one shared goal</p>
          </div>
          <button className="link-btn" onClick={() => go('members')}>
            Members <ArrowRight size={16} />
          </button>
        </div>
        <div className="avatars">
          {active.map((m) => (
            <Avatar key={m.id} member={member(m.id)} title={m.name + (m.is_leader ? ' (group leader)' : '')} />
          ))}
        </div>
      </section>
    </>
  );
}

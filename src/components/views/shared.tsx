'use client';

import { Clock, Video } from 'lucide-react';
import { fmtDate, sessionTimes, todayInGroup } from '@/lib/time';
import type { AppState, Session } from '@/lib/types';

export const KIND_LABELS: Record<Session['kind'], string> = {
  study: 'Study session',
  qa: 'Q&A session',
  workshop: 'Workshop',
  case: 'Case study',
  mock: 'Mock interview',
  other: 'Other',
};

export function upcomingSessions(state: AppState) {
  const today = todayInGroup();
  const now = Date.now();
  return state.sessions.filter(
    (s) => s.status === 'Planned' && s.session_date >= today && !(s.ends_at && Date.parse(s.ends_at) < now),
  );
}

export const WORKSHOP_TARGET = 2;

export function nextWorkshop(state: AppState) {
  return upcomingSessions(state).find((s) => s.kind === 'workshop') ?? null;
}

export function SessionWhen({ session }: { session: Pick<Session, 'starts_at' | 'ends_at' | 'hours'> }) {
  const times = sessionTimes(session);
  return (
    <span className="when">
      {times ? (
        times.map((t) => (
          <span key={t.label} className="zone-time">
            <b>{t.label}</b>
            {t.text}
          </span>
        ))
      ) : (
        <span>
          <Clock size={13} />
          Time to be confirmed{session.hours ? ` · ${session.hours} h planned` : ''}
        </span>
      )}
    </span>
  );
}

export function DateTile({ date }: { date: string }) {
  return (
    <span className="date-tile" aria-hidden="true">
      <b>{Number(date.slice(8))}</b>
      <small>{fmtDate(date, { month: 'short' })}</small>
    </span>
  );
}

export function SessionRow({ session, onClick }: { session: Session; onClick?: () => void }) {
  const content = (
    <>
      <DateTile date={session.session_date} />
      <div>
        <strong>{session.title}</strong>
        <small>
          {fmtDate(session.session_date, { weekday: 'long', day: 'numeric', month: 'long' })} · {KIND_LABELS[session.kind]}
        </small>
        <SessionWhen session={session} />
      </div>
    </>
  );
  return onClick ? (
    <button className="list-item" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="list-item">{content}</div>
  );
}

export function meetingLabel(url: string) {
  try {
    const host = new URL(url).hostname;
    if (host.endsWith('teams.microsoft.com') || host.endsWith('teams.live.com')) return 'Join on Teams';
    if (host.endsWith('zoom.us')) return 'Join on Zoom';
    if (host === 'meet.google.com') return 'Join on Google Meet';
  } catch {}
  return 'Join meeting';
}

export function JoinButton({ url, small }: { url: string; small?: boolean }) {
  if (!url) return null;
  return (
    <a className={'btn primary' + (small ? ' small' : '')} href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
      <Video size={16} /> {meetingLabel(url)}
    </a>
  );
}

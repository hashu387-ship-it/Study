'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Compass,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  LoaderCircle,
  Megaphone,
  MessageCircleQuestion,
  MessagesSquare,
  MoreHorizontal,
  Presentation,
  Users,
} from 'lucide-react';
import { api } from '@/lib/client/api';
import { registerWorker } from '@/lib/client/push';
import type { AppState } from '@/lib/types';
import { HubContext, type Hub, type View } from './hub';
import { Avatar, Sheet } from './ui';
import { Welcome } from './Welcome';
import { Overview } from './views/Overview';
import { Announcements } from './views/Announcements';
import { Calendar } from './views/Calendar';
import { Attendance } from './views/Attendance';
import { Soe } from './views/Soe';
import { QaPractice } from './views/QaPractice';
import { Cases } from './views/Cases';
import { Discussions } from './views/Discussions';
import { Alerts } from './views/Alerts';
import { Members } from './views/Members';
import { HowItWorks } from './views/HowItWorks';

const NAV: { view: View; label: string; icon: typeof Bell }[] = [
  { view: 'overview', label: 'Home', icon: LayoutDashboard },
  { view: 'guide', label: 'How it works', icon: Compass },
  { view: 'announcements', label: 'Announcements', icon: Megaphone },
  { view: 'calendar', label: 'Calendar', icon: CalendarDays },
  { view: 'attendance', label: 'Attendance', icon: ClipboardCheck },
  { view: 'soe', label: 'SOE register', icon: BookOpen },
  { view: 'qa', label: 'Q&A practice', icon: MessageCircleQuestion },
  { view: 'cases', label: 'Case studies', icon: Presentation },
  { view: 'posts', label: 'Discussions', icon: MessagesSquare },
  { view: 'alerts', label: 'Alerts', icon: Bell },
  { view: 'members', label: 'Members', icon: Users },
];

// Each area has its own colour; everything else stays bronze.
export const TONE: Partial<Record<View, 'green' | 'blue' | 'orange' | 'purple'>> = {
  soe: 'green',
  calendar: 'blue',
  attendance: 'blue',
  qa: 'orange',
  cases: 'orange',
  posts: 'purple',
  announcements: 'purple',
  alerts: 'purple',
};

const DOCK: View[] = ['overview', 'soe', 'calendar', 'posts'];
const VIEWS = new Set(NAV.map((n) => n.view));

function readLocation() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view') as View | null;
  return { view: view && VIEWS.has(view) ? view : 'overview', params };
}

export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<View>('overview');
  const [params, setParams] = useState(() => new URLSearchParams());
  const [toasts, setToasts] = useState<{ id: number; message: string; kind?: 'error' }[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const inflight = useRef<Promise<void> | null>(null);
  const again = useRef(false);

  // A reload asked for while one is running fetches again afterwards, so saved changes always show.
  const reload = useCallback(async () => {
    if (inflight.current) {
      again.current = true;
      return inflight.current;
    }
    const run = async () => {
      do {
        again.current = false;
        try {
          setState(await api<AppState>('/api/state'));
          setLoadError('');
        } catch (error) {
          setLoadError((error as Error).message);
        }
      } while (again.current);
    };
    inflight.current = run().finally(() => {
      inflight.current = null;
    });
    return inflight.current;
  }, []);

  const toast = useCallback((message: string, kind?: 'error') => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all.slice(-2), { id, message, kind }]);
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);

  const go = useCallback((next: View, extra: Record<string, string> = {}) => {
    const search = new URLSearchParams({ ...(next === 'overview' ? {} : { view: next }), ...extra });
    const url = search.toString() ? `/?${search}` : '/';
    window.history.pushState(null, '', url);
    setView(next);
    setParams(search);
    setMoreOpen(false);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const sync = () => {
      const location = readLocation();
      setView(location.view);
      setParams(location.params);
    };
    sync();
    reload();
    registerWorker();
    window.addEventListener('popstate', sync);
    const onVisible = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => document.visibilityState === 'visible' && reload(), 45_000);
    return () => {
      window.removeEventListener('popstate', sync);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [reload]);

  const hub = useMemo<Hub | null>(() => {
    if (!state?.me) return null;
    const byId = new Map(state.members.map((m) => [m.id, m]));
    return {
      state,
      me: state.me,
      reload,
      go,
      params,
      toast,
      member: (id) => (id ? byId.get(id) : undefined),
      name: (id) => (id ? byId.get(id)?.name ?? 'Former member' : 'Unassigned'),
      label: (id) => (id ? `${byId.get(id)?.name ?? 'Former member'} · ${id}` : 'Unassigned'),
    };
  }, [state, reload, go, params, toast]);

  const toastList = (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={'toast ' + (t.kind ?? '')}>
          {t.message}
        </div>
      ))}
    </div>
  );

  if (!state) {
    return (
      <div className="welcome">
        <div className="welcome-card">
          {loadError ? (
            <>
              <p className="error">{loadError}</p>
              <button className="btn primary" style={{ marginTop: 18 }} onClick={reload}>
                Try again
              </button>
            </>
          ) : (
            <p className="muted row" style={{ justifyContent: 'center' }}>
              <LoaderCircle className="spin" size={20} /> Opening your study hub…
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!hub || switching) {
    return (
      <>
        <Welcome
          members={state.members}
          current={state.me?.memberId}
          onBack={state.me ? () => setSwitching(false) : undefined}
          onChosen={async () => {
            await reload();
            setSwitching(false);
          }}
          toast={toast}
        />
        {toastList}
      </>
    );
  }

  const unseenAnnouncements = state.announcements.filter((a) => !a.seen_by.includes(hub.me.memberId)).length;
  const counts: Partial<Record<View, number>> = { alerts: state.unread, announcements: unseenAnnouncements };
  const current = NAV.find((n) => n.view === view)!;
  const meMember = hub.member(hub.me.memberId);

  return (
    <HubContext.Provider value={hub}>
      <div className="app" data-tone={TONE[view] ?? 'bronze'}>
        <aside className="sidebar">
          <div className="brand">
            Group 03
            <small>RICS APC tracker</small>
          </div>
          <nav className="nav" aria-label="Sections">
            <div className="nav-label">Workspace</div>
            {NAV.map(({ view: v, label, icon: Icon }) => (
              <button key={v} className="nav-item" data-tone={TONE[v] ?? 'bronze'} aria-current={view === v ? 'page' : undefined} onClick={() => go(v)}>
                <Icon size={18} />
                {label}
                {counts[v] ? <span className="count">{counts[v]}</span> : null}
              </button>
            ))}
          </nav>
          <div className="sidebar-foot">
            <strong>Quantity Surveying &amp; Construction</strong>
            Prepare evidence, practise answers, and show up for each other.
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="brand">Group 03</div>
            <h1>{current.label}</h1>
            <button className="icon-btn" onClick={() => go('alerts')} aria-label={`Alerts${state.unread ? `, ${state.unread} unread` : ''}`}>
              <Bell size={20} />
              {state.unread ? <span className="count">{state.unread}</span> : null}
            </button>
            <button className="me-chip" onClick={() => setSwitching(true)} aria-label={`You are ${hub.me.name}. Switch member`}>
              <Avatar member={meMember} size="sm" />
              <span>{hub.me.name}</span>
            </button>
          </header>

          <main className="content">
            {view === 'overview' && <Overview />}
            {view === 'announcements' && <Announcements />}
            {view === 'calendar' && <Calendar />}
            {view === 'attendance' && <Attendance />}
            {view === 'soe' && <Soe />}
            {view === 'qa' && <QaPractice />}
            {view === 'cases' && <Cases />}
            {view === 'posts' && <Discussions />}
            {view === 'alerts' && <Alerts />}
            {view === 'members' && <Members />}
            {view === 'guide' && <HowItWorks />}
          </main>
        </div>

        <nav className="dock" aria-label="Main sections">
          {DOCK.map((v) => {
            const item = NAV.find((n) => n.view === v)!;
            const Icon = item.icon;
            return (
              <button key={v} data-tone={TONE[v] ?? 'bronze'} aria-current={view === v ? 'page' : undefined} onClick={() => go(v)}>
                <Icon size={21} />
                {v === 'overview' ? 'Home' : v === 'soe' ? 'SOE' : v === 'posts' ? 'Posts' : item.label}
              </button>
            );
          })}
          <button aria-current={!DOCK.includes(view) ? 'page' : undefined} onClick={() => setMoreOpen(true)}>
            <MoreHorizontal size={21} />
            More
            {state.unread + unseenAnnouncements ? <span className="count">{state.unread + unseenAnnouncements}</span> : null}
          </button>
        </nav>

        <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="All sections">
          <div className="nav">
            {NAV.map(({ view: v, label, icon: Icon }) => (
              <button key={v} className="nav-item" data-tone={TONE[v] ?? 'bronze'} aria-current={view === v ? 'page' : undefined} onClick={() => go(v)}>
                <Icon size={18} />
                {label}
                {counts[v] ? <span className="count">{counts[v]}</span> : null}
              </button>
            ))}
          </div>
        </Sheet>
      </div>
      {toastList}
    </HubContext.Provider>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, ChevronRight, Smartphone } from 'lucide-react';
import { api } from '@/lib/client/api';
import { currentSubscription, disablePush, enablePush, pushSupport, type PushSupport } from '@/lib/client/push';
import { ago } from '@/lib/time';
import type { Notice } from '@/lib/types';
import { attempt, useHub, type View } from '../hub';
import { Avatar, Empty, PageHead } from '../ui';

function target(n: Notice): [View, Record<string, string>?] {
  switch (n.kind) {
    case 'soe':
    case 'question':
    case 'answer':
      return ['soe', { record: n.ref }];
    case 'post':
    case 'reply':
      return ['posts', { post: n.ref }];
    case 'announcement':
      return ['announcements'];
    case 'presentation':
      return ['cases', { record: n.ref }];
    case 'session':
      return ['calendar', { session: n.ref }];
    default:
      return ['overview'];
  }
}

export function Alerts() {
  const hub = useHub();
  const { go, member, reload } = hub;
  const [items, setItems] = useState<Notice[] | null>(null);
  const [readAt, setReadAt] = useState<string | null>(null);
  const [support, setSupport] = useState<PushSupport>('unsupported');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupport(pushSupport());
    currentSubscription().then((s) => setEnabled(Boolean(s)), () => {});
    api<{ items: Notice[]; readAt: string | null }>('/api/notifications')
      .then(async (data) => {
        setItems(data.items);
        setReadAt(data.readAt);
        await api('/api/notifications', { body: {} });
        await reload();
      })
      .catch((e) => hub.toast((e as Error).message, 'error'));
  }, []);

  async function toggle() {
    setBusy(true);
    const ok = await attempt(hub, enabled ? disablePush : enablePush, enabled ? 'Alerts turned off on this device.' : 'Alerts are on for this device.');
    if (ok) setEnabled(!enabled);
    setBusy(false);
  }

  return (
    <>
      <PageHead eyebrow="Stay in the loop" title="Alerts" text="New SOE submissions, posts, replies, announcements, ready presentations and session reminders." />

      <div className="grid two" style={{ marginBottom: 22 }}>
        <section className="card">
          <div className="card-head">
            <div>
              <h3>Phone and desktop alerts</h3>
              <p>{enabled ? 'On for this device.' : 'Off for this device.'} Each phone or computer is set up separately.</p>
            </div>
            {enabled ? <Bell size={24} className="muted" /> : <BellOff size={24} className="muted" />}
          </div>
          {support === 'supported' ? (
            <button className={'btn ' + (enabled ? '' : 'primary')} onClick={toggle} disabled={busy}>
              {enabled ? <BellOff size={18} /> : <Bell size={18} />} {busy ? 'Working…' : enabled ? 'Turn off alerts' : 'Turn on alerts'}
            </button>
          ) : support === 'needs-install' ? (
            <p className="note yellow">
              On iPhone, alerts only work from the Home Screen app. Tap Share, then Add to Home Screen, open the hub from your Home
              Screen, and come back here to turn alerts on.
            </p>
          ) : (
            <p className="note">This browser doesn't support alerts. Try Chrome, Edge, Firefox or Safari.</p>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h3>Use it like an app</h3>
              <p>Add the hub to your Home Screen for one-tap access.</p>
            </div>
            <Smartphone size={24} className="muted" />
          </div>
          <p className="small">
            <strong>iPhone:</strong> open in Safari, tap Share, then Add to Home Screen.
            <br />
            <strong>Android:</strong> open in Chrome, tap the menu, then Add to Home screen or Install app.
          </p>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h3>Group activity</h3>
            <p>Latest 60 updates</p>
          </div>
        </div>
        <div className="list">
          {items?.map((n) => {
            const [view, params] = target(n);
            const unread = !readAt || n.created_at > readAt;
            return (
              <button key={n.id} className="list-item" onClick={() => go(view, params)}>
                <Avatar member={member(n.actor)} size="sm" />
                <div>
                  <strong>
                    {n.title} {unread && <span className="badge yellow">New</span>}
                  </strong>
                  <small className="clamp" style={{ WebkitLineClamp: 2 }}>
                    {n.body}
                  </small>
                  <small>{ago(n.created_at)}</small>
                </div>
                <ChevronRight size={18} className="muted" />
              </button>
            );
          })}
          {items && !items.length && <Empty icon={<Bell size={28} />}>Nothing yet. Activity from the group will show up here.</Empty>}
          {!items && <p className="muted">Loading…</p>}
        </div>
      </section>
    </>
  );
}

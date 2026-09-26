'use client';

import { useEffect, useRef, useState } from 'react';
import { BellRing, Copy, Megaphone, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/client/api';
import { ago } from '@/lib/time';
import { attempt, useHub } from '../hub';
import { Avatar, Empty, Field, PageHead, Sheet } from '../ui';

export function Announcements() {
  const hub = useHub();
  const { state, me, member, name, label, reload } = hub;
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const marked = useRef(new Set<string>());
  const active = state.members.filter((m) => m.status === 'Active');

  // Opening this page counts as seeing every announcement on it.
  useEffect(() => {
    const unseen = state.announcements
      .filter((a) => !a.seen_by.includes(me.memberId) && !marked.current.has(a.id))
      .map((a) => a.id);
    if (!unseen.length) return;
    unseen.forEach((id) => marked.current.add(id));
    api('/api/announcements', { body: { action: 'seen', ids: unseen } }).then(reload, () => {});
  }, [state.announcements, me.memberId, reload]);

  async function publish() {
    setBusy(true);
    const ok = await attempt(
      hub,
      async () => {
        await api('/api/announcements', { body: { title, body } });
        await reload();
      },
      'Announcement posted. Everyone with alerts on has been notified.',
    );
    setBusy(false);
    if (ok) {
      setComposing(false);
      setTitle('');
      setBody('');
    }
  }

  return (
    <>
      <PageHead
        eyebrow="Group notices"
        title="Announcements"
        text="Important messages for the whole group. You can see who has opened each one and remind anyone who hasn't."
        action={
          <button className="btn primary" onClick={() => setComposing(true)}>
            <Plus size={18} /> New announcement
          </button>
        }
      />

      <div className="grid">
        {state.announcements.map((a) => {
          const author = member(a.member_id);
          const pending = active.filter((m) => !a.seen_by.includes(m.id));
          const canRemove = a.member_id === me.memberId || me.isLeader;
          return (
            <article key={a.id} className="card post">
              <div className="post-meta">
                <Avatar member={author} />
                <div>
                  <strong>
                    {label(a.member_id)}
                    {author?.is_leader && <span className="badge yellow">Group leader</span>}
                  </strong>
                  <small>{ago(a.created_at)}</small>
                </div>
              </div>
              <h3>{a.title}</h3>
              <p className="post-body">{a.body}</p>
              <div className="inset">
                <div className="row" style={{ marginBottom: 10 }}>
                  <strong className="small">
                    Seen by {active.length - pending.length} of {active.length}
                  </strong>
                </div>
                <div className="avatars">
                  {active.map((m) => (
                    <Avatar
                      key={m.id}
                      member={m}
                      size="sm"
                      faded={!a.seen_by.includes(m.id)}
                      title={`${m.name}: ${a.seen_by.includes(m.id) ? 'seen' : 'not seen yet'}`}
                    />
                  ))}
                </div>
                {pending.length > 0 && (
                  <p className="small muted" style={{ marginTop: 10 }}>
                    Not seen yet: {pending.map((m) => m.name).join(', ')}
                  </p>
                )}
              </div>
              <div className="row">
                {pending.length > 0 && (
                  <button
                    className="btn small"
                    onClick={() =>
                      attempt(hub, async () => {
                        const result = await api<{ pending: number; delivered: number }>('/api/announcements', {
                          body: { action: 'nudge', id: a.id },
                        });
                        hub.toast(
                          result.delivered
                            ? `Reminder sent to ${result.delivered} device${result.delivered === 1 ? '' : 's'}.`
                            : 'Nobody who is still to read it has alerts turned on. Try WhatsApp instead.',
                        );
                      })
                    }
                  >
                    <BellRing size={16} /> Nudge the rest
                  </button>
                )}
                <button
                  className="btn small"
                  onClick={() =>
                    attempt(
                      hub,
                      () => navigator.clipboard.writeText(`*${a.title}*\n\n${a.body}\n\n${window.location.origin}/?view=announcements`),
                      'Copied. Paste it into WhatsApp.',
                    )
                  }
                >
                  <Copy size={16} /> Copy for WhatsApp
                </button>
                <span className="spacer" />
                {canRemove && (
                  <button
                    className="btn small danger"
                    onClick={() => {
                      if (!confirm('Remove this announcement for everyone?')) return;
                      attempt(
                        hub,
                        async () => {
                          await api('/api/announcements', { method: 'DELETE', body: { id: a.id } });
                          await reload();
                        },
                        'Announcement removed.',
                      );
                    }}
                  >
                    <Trash2 size={16} /> Remove
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {!state.announcements.length && (
          <div className="card">
            <Empty icon={<Megaphone size={30} />}>No announcements yet.</Empty>
          </div>
        )}
      </div>

      <Sheet
        open={composing}
        onClose={() => setComposing(false)}
        busy={busy}
        title="New announcement"
        subtitle={`Posting as ${me.name}. Everyone with alerts on gets a notification.`}
        footer={
          <>
            <button className="btn" onClick={() => setComposing(false)} disabled={busy}>
              Cancel
            </button>
            <button className="btn primary" onClick={publish} disabled={busy || !title.trim() || !body.trim()}>
              <Megaphone size={17} /> {busy ? 'Posting…' : 'Post announcement'}
            </button>
          </>
        }
      >
        <div className="form">
          <Field label="Title" wide>
            <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Workshop moved to 8 pm" />
          </Field>
          <Field label="Message" wide>
            <textarea value={body} maxLength={10000} rows={8} onChange={(e) => setBody(e.target.value)} />
          </Field>
        </div>
      </Sheet>
    </>
  );
}

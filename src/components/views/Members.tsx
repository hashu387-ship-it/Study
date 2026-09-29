'use client';

import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { api } from '@/lib/client/api';
import { PATHWAYS, type Member } from '@/lib/types';
import { useHub } from '../hub';
import { Avatar, Empty, Field, PageHead, Select, Sheet } from '../ui';

type Draft = Pick<Member, 'name' | 'pathway' | 'notes' | 'status'> & { id?: string; revision?: number };

export function Members() {
  const hub = useHub();
  const { state, reload } = hub;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const markedSessions = new Set(state.attendance.map((a) => a.session_id));

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/members', { method: draft.id ? 'PATCH' : 'POST', body: draft });
      await reload();
      hub.toast(draft.id ? 'Member updated.' : 'Member added.');
      setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        eyebrow="Study circle"
        title="Members"
        text="Everyone preparing together in Group 03. Only names are stored here; contact details stay in your WhatsApp group."
        action={
          <button className="btn primary" onClick={() => setDraft({ name: '', pathway: PATHWAYS[0], notes: '', status: 'Active' })}>
            <Plus size={18} /> Add member
          </button>
        }
      />
      <div className="grid three">
        {state.members.map((m) => {
          const soe = state.soe.filter((s) => s.member_id === m.id);
          const levels = soe.reduce((n, s) => n + s.words.filter(Boolean).length, 0);
          const attended = state.attendance.filter((a) => a.member_id === m.id && (a.status === 'present' || a.status === 'late')).length;
          const presentation = state.cases.find((c) => c.member_id === m.id)?.presentation_status;
          return (
            <button
              key={m.id}
              className="card record-card"
              onClick={() => {
                setError('');
                setDraft({ id: m.id, revision: m.revision, name: m.name, pathway: m.pathway, notes: m.notes, status: m.status });
              }}
            >
              <div className="record-top">
                <Avatar member={m} size="lg" />
                <div>
                  <strong>{m.name}</strong>
                  <small>
                    <span className="code">{m.id}</span> · {m.pathway}
                  </small>
                </div>
              </div>
              <div className="row">
                {m.is_leader && <span className="badge yellow">Group leader</span>}
                {m.status === 'Inactive' && <span className="badge grey">Inactive</span>}
                {presentation && <span className="badge">Presentation: {presentation.toLowerCase()}</span>}
              </div>
              {m.notes && <p className="small muted clamp">{m.notes}</p>}
              <div className="record-foot">
                <span>
                  SOE levels {levels}/{soe.length * 3}
                </span>
                <span>{markedSessions.size ? `Attended ${attended} of ${markedSessions.size}` : 'No attendance yet'}</span>
              </div>
            </button>
          );
        })}
      </div>
      {!state.members.length && <Empty icon={<Users size={30} />}>No members yet.</Empty>}

      <Sheet
        open={!!draft}
        onClose={() => setDraft(null)}
        busy={busy}
        title={draft?.id ? 'Edit member' : 'Add member'}
        subtitle="Everyone in the group can update this."
        footer={
          <>
            <button className="btn" onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </button>
            <button className="btn primary" onClick={save} disabled={busy || !draft?.name.trim()}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {draft && (
          <div className="form">
            <Field label="Name" wide>
              <input value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="RICS pathway">
              <Select value={draft.pathway} onChange={(v) => setDraft({ ...draft, pathway: v })} options={PATHWAYS} />
            </Field>
            <Field label="Status">
              <Select value={draft.status} onChange={(v) => setDraft({ ...draft, status: v as Member['status'] })} options={['Active', 'Inactive']} />
            </Field>
            <Field label="Availability or notes" wide>
              <textarea rows={3} maxLength={2000} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </Field>
            {error && <p className="error wide">{error}</p>}
          </div>
        )}
      </Sheet>
    </>
  );
}

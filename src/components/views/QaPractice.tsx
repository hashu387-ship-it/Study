'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, MessageCircleQuestion, Plus } from 'lucide-react';
import { api } from '@/lib/client/api';
import { ago } from '@/lib/time';
import { REVIEW_STATUSES, type Qa } from '@/lib/types';
import { attempt, useHub } from '../hub';
import { Avatar, Empty, Field, PageHead, Select, Sheet, StatusBadge } from '../ui';

// Answer structure from the workbook's Read Me.
const PARTS = [
  { key: 'context', label: 'Context / opening', hint: 'The issue, project situation, your responsibility and the relevant facts.' },
  { key: 'action', label: 'Professional action / advice', hint: 'What you did or would advise, options considered, commercial judgement, stakeholders.' },
  { key: 'basis', label: 'RICS / contract basis and buzzwords', hint: 'Standards, contract principles, due diligence, audit trail, impartiality, risk, value for money.' },
  { key: 'outcome', label: 'Outcome / reflection', hint: 'The result, lesson learned, risk mitigated and what you would do differently.' },
] as const;

export function QaPractice() {
  const hub = useHub();
  const { state, me, params, member, name, reload } = hub;
  const [filter, setFilter] = useState<'all' | 'questioner' | 'candidate'>('all');
  const [soeFocus, setSoeFocus] = useState<string | null>(null);
  const [editing, setEditing] = useState<Qa | null>(null);

  useEffect(() => {
    setSoeFocus(params.get('soe'));
    if (params.get('mine') === 'questioner') setFilter('questioner');
  }, [params]);

  const records = state.soe.filter(
    (s) =>
      (!soeFocus || s.id === soeFocus) &&
      (filter === 'all' || (filter === 'questioner' ? s.questioner_id === me.memberId : s.member_id === me.memberId)),
  );

  return (
    <>
      <PageHead
        eyebrow="Practise together"
        title="Q&A practice"
        text="The assigned questioner writes three competency-based questions. The candidate builds each answer in four parts, and anyone can leave feedback."
      />

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Show">
          <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            Everyone
          </button>
          <button aria-pressed={filter === 'questioner'} onClick={() => setFilter('questioner')}>
            I ask
          </button>
          <button aria-pressed={filter === 'candidate'} onClick={() => setFilter('candidate')}>
            I answer
          </button>
        </div>
        {soeFocus && (
          <button className="btn small" onClick={() => setSoeFocus(null)}>
            Show all competencies
          </button>
        )}
      </div>

      <div className="grid two">
        {records.map((s) => {
          const questions = state.qa.filter((q) => q.soe_id === s.id);
          return (
            <section key={s.id} className="card">
              <div className="record-top" style={{ marginBottom: 12 }}>
                <Avatar member={member(s.member_id)} />
                <div>
                  <strong>{name(s.member_id)}</strong>
                  <small>
                    {s.competency} · questioner: {s.questioner_id ? name(s.questioner_id) : 'not assigned'}
                  </small>
                </div>
              </div>
              <div className="list">
                {questions.map((q) => (
                  <button key={q.id} className="list-item" onClick={() => setEditing(q)}>
                    <span className="medallion" style={{ width: 34, height: 34, fontSize: 13 }}>
                      Q{q.number}
                    </span>
                    <div>
                      <strong className="clamp" style={{ WebkitLineClamp: 2 }}>
                        {q.question || <span className="muted">Question not written yet</span>}
                      </strong>
                      <small>{q.updated_by ? `Updated ${ago(q.updated_at)} by ${name(q.updated_by)}` : 'Not started'}</small>
                    </div>
                    <StatusBadge status={q.status} />
                  </button>
                ))}
              </div>
              <button
                className="link-btn"
                style={{ marginTop: 12 }}
                onClick={() =>
                  attempt(
                    hub,
                    async () => {
                      await api('/api/qa', { body: { soe_id: s.id } });
                      await reload();
                    },
                    'Question added.',
                  )
                }
              >
                <Plus size={16} /> Add a question
              </button>
            </section>
          );
        })}
      </div>
      {!records.length && (
        <div className="card">
          <Empty icon={<MessageCircleQuestion size={30} />}>
            {filter === 'questioner' ? 'Nobody has assigned you as a questioner yet.' : 'Nothing to show here yet.'}
          </Empty>
        </div>
      )}

      {editing && <QaEditor qa={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function QaEditor({ qa, onClose }: { qa: Qa; onClose: () => void }) {
  const hub = useHub();
  const { state, name, reload, go } = hub;
  const soe = state.soe.find((s) => s.id === qa.soe_id);
  const [draft, setDraft] = useState(qa);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof Qa, value: string) => setDraft({ ...draft, [key]: value });

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api('/api/qa', { method: 'PATCH', body: draft });
      await reload();
      hub.toast('Saved.');
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      busy={busy}
      title={`Question ${qa.number} · ${soe?.competency ?? ''}`}
      subtitle={`Candidate: ${name(soe?.member_id)} · questioner: ${soe?.questioner_id ? name(soe.questioner_id) : 'not assigned'}`}
      footer={
        <>
          {soe && (
            <button className="btn" onClick={() => go('soe', { record: soe.id })} disabled={busy}>
              View SOE <ArrowUpRight size={16} />
            </button>
          )}
          <span className="spacer" />
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="form">
        <Field label="Competency-based question" wide>
          <textarea rows={3} maxLength={4000} value={draft.question} onChange={(e) => set('question', e.target.value)} />
        </Field>
        {PARTS.map((part) => (
          <Field key={part.key} label={part.label} hint={part.hint} wide>
            <textarea rows={4} maxLength={8000} value={draft[part.key]} onChange={(e) => set(part.key, e.target.value)} />
          </Field>
        ))}
        <Field label="Peer or mentor feedback" wide>
          <textarea rows={3} maxLength={8000} value={draft.feedback} onChange={(e) => set('feedback', e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={draft.status} onChange={(v) => set('status', v)} options={[...REVIEW_STATUSES]} />
        </Field>
        {error && <p className="error wide">{error}</p>}
      </div>
    </Sheet>
  );
}

'use client';

import { Tip } from '../guide';
import { QaArt } from '../illustrations';
import { useEffect, useState } from 'react';
import { ArrowUpRight, MessageCircleQuestion, Plus } from 'lucide-react';
import { api } from '@/lib/client/api';
import { ago } from '@/lib/time';
import { REVIEW_STATUSES, type Qa, type SoeSummary } from '@/lib/types';
import { attempt, useHub } from '../hub';
import { Avatar, Empty, Field, PageHead, Select, Sheet, StatusBadge } from '../ui';

// Answer structure from the workbook's Read Me.
const PARTS = [
  { key: 'context', label: 'Context / opening', hint: 'The issue, project situation, your responsibility and the relevant facts.' },
  { key: 'action', label: 'Professional action / advice', hint: 'What you did or would advise, options considered, commercial judgement, stakeholders.' },
  { key: 'basis', label: 'RICS / contract basis and buzzwords', hint: 'Standards, contract principles, due diligence, audit trail, impartiality, risk, value for money.' },
  { key: 'outcome', label: 'Outcome / reflection', hint: 'The result, lesson learned, risk mitigated and what you would do differently.' },
] as const;

// Each member sees only the questions they write and the questions written for them.
export function QaPractice() {
  const { state, me, params } = useHub();
  const [editing, setEditing] = useState<Qa | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    setFocus(params.get('soe'));
    if (params.get('mine') === 'questioner') document.getElementById('i-ask')?.scrollIntoView();
  }, [params]);

  const inFocus = (s: SoeSummary) => !focus || s.id === focus;
  const asking = state.soe.filter((s) => s.questioner_id === me.memberId && inFocus(s));
  const answering = state.soe.filter((s) => s.member_id === me.memberId && inFocus(s));

  return (
    <>
      <PageHead
        eyebrow="Practise together"
        title="Q&A practice"
        text="You see the questions you write for others, and the questions others write for you. The questioner writes each question, the candidate answers it, and both can leave feedback."
      />
      <Tip id="qa" art={QaArt} title="Ask and answer">
        The questioner writes each question. The candidate answers in four parts: context, action, RICS basis, outcome. Both of you can leave feedback.
      </Tip>

      {focus && (
        <div className="toolbar">
          <button className="btn small" onClick={() => setFocus(null)}>
            Show all my questions
          </button>
        </div>
      )}

      <h3 id="i-ask" className="section-title">
        Questions I ask
      </h3>
      <div className="grid two" style={{ marginBottom: 28 }}>
        {asking.map((s) => (
          <Record key={s.id} soe={s} role="questioner" onOpen={setEditing} />
        ))}
      </div>
      {!asking.length && (
        <div className="card" style={{ marginBottom: 28 }}>
          <Empty icon={<MessageCircleQuestion size={28} />}>
            Nobody has assigned you as a questioner yet. Questioners are set on each record in the SOE register.
          </Empty>
        </div>
      )}

      <h3 className="section-title">Questions for me</h3>
      <div className="grid two">
        {answering.map((s) => (
          <Record key={s.id} soe={s} role="candidate" onOpen={setEditing} />
        ))}
      </div>
      {!answering.length && (
        <div className="card">
          <Empty icon={<MessageCircleQuestion size={28} />}>You have no competencies in the SOE register yet.</Empty>
        </div>
      )}

      {editing && <QaEditor qa={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function Record({ soe, role, onOpen }: { soe: SoeSummary; role: 'questioner' | 'candidate'; onOpen: (qa: Qa) => void }) {
  const hub = useHub();
  const { state, member, name, reload } = hub;
  const questions = state.qa.filter((q) => q.soe_id === soe.id);
  const other = role === 'questioner' ? soe.member_id : soe.questioner_id;
  return (
    <section className="card">
      <div className="record-top" style={{ marginBottom: 12 }}>
        <Avatar member={member(other)} />
        <div>
          <strong>{role === 'questioner' ? `For ${name(soe.member_id)}` : soe.competency}</strong>
          <small>
            {role === 'questioner'
              ? soe.competency
              : soe.questioner_id
                ? `Questions from ${name(soe.questioner_id)}`
                : 'No questioner assigned yet'}
          </small>
        </div>
      </div>
      <div className="list">
        {questions.map((q) => (
          <button key={q.id} className="list-item" onClick={() => onOpen(q)}>
            <span className="medallion" style={{ width: 34, height: 34, fontSize: 13 }}>
              Q{q.number}
            </span>
            <div>
              <strong className="clamp" style={{ WebkitLineClamp: 2 }}>
                {q.question || (
                  <span className="muted">{role === 'questioner' ? 'Write this question' : 'Question not written yet'}</span>
                )}
              </strong>
              <small>{q.updated_by ? `Updated ${ago(q.updated_at)} by ${name(q.updated_by)}` : 'Not started'}</small>
            </div>
            <StatusBadge status={q.status} />
          </button>
        ))}
      </div>
      {role === 'questioner' && (
        <button
          className="link-btn"
          style={{ marginTop: 12 }}
          onClick={() =>
            attempt(
              hub,
              async () => {
                await api('/api/qa', { body: { soe_id: soe.id } });
                await reload();
              },
              'Question added.',
            )
          }
        >
          <Plus size={16} /> Add a question
        </button>
      )}
    </section>
  );
}

function QaEditor({ qa, onClose }: { qa: Qa; onClose: () => void }) {
  const hub = useHub();
  const { state, me, name, reload, go } = hub;
  const soe = state.soe.find((s) => s.id === qa.soe_id);
  const isQuestioner = soe?.questioner_id === me.memberId;
  const isCandidate = soe?.member_id === me.memberId;
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
        <p className="note wide">
          {isQuestioner
            ? `You write the question. ${name(soe?.member_id)} writes the answer.`
            : 'Your questioner writes the question. You write the answer in four parts.'}{' '}
          You can both add feedback.
        </p>
        <Field label="Competency-based question" wide>
          <textarea rows={3} maxLength={4000} value={draft.question} disabled={!isQuestioner} onChange={(e) => set('question', e.target.value)} />
        </Field>
        {PARTS.map((part) => (
          <Field key={part.key} label={part.label} hint={isCandidate ? part.hint : undefined} wide>
            <textarea rows={4} maxLength={8000} value={draft[part.key]} disabled={!isCandidate} onChange={(e) => set(part.key, e.target.value)} />
          </Field>
        ))}
        <Field label="Feedback and comments" wide>
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

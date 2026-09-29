'use client';

import { Tip } from '../guide';
import { QaArt } from '../illustrations';
import { useEffect, useState } from 'react';
import { ArrowUpRight, MessageCircleQuestion, PenLine, Send, Trash2 } from 'lucide-react';
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

export const answered = (q: Qa) => PARTS.some((p) => q[p.key].trim());

// Each member sees the questions asked on their own SOE, and the questions they asked others.
export function QaPractice() {
  const { state, me, params, name, go } = useHub();
  const [editing, setEditing] = useState<Qa | null>(null);

  useEffect(() => {
    const id = params.get('qa');
    const qa = id && state.qa.find((q) => q.id === id);
    if (qa) setEditing(qa);
  }, [params]);

  const mySoe = new Set(state.soe.filter((s) => s.member_id === me.memberId).map((s) => s.id));
  const forMe = state.qa.filter((q) => mySoe.has(q.soe_id)).sort((a, b) => Number(answered(a)) - Number(answered(b)) || b.updated_at.localeCompare(a.updated_at));
  const asked = state.qa.filter((q) => q.asked_by === me.memberId).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const open = state.soe.filter((s) => s.member_id !== me.memberId && s.submitted_at);

  return (
    <>
      <PageHead
        eyebrow="Practise together"
        title="Q&A practice"
        text="When someone submits their SOE, every other candidate asks them one question on each level and they answer. Here you see the questions on your SOE and the ones you asked."
      />
      <Tip id="qa-v2" art={QaArt} title="Ask and answer">
        Open a submitted SOE and ask its owner one question on each level. When the group asks about yours, answer in four parts: context, action, RICS basis, outcome. Anyone can add feedback.
      </Tip>

      <h3 className="section-title">Questions on my SOE</h3>
      {forMe.length ? (
        <div className="list card" style={{ marginBottom: 28 }}>
          {forMe.map((q) => (
            <QuestionRow key={q.id} qa={q} who={q.asked_by} whoLabel="Asked by" onOpen={setEditing} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 28 }}>
          <Empty art={false}>
            Nobody has asked about your SOE yet. Once you submit a competency, the group can ask you questions on it.
          </Empty>
        </div>
      )}

      <h3 className="section-title">Questions I asked</h3>
      {asked.length ? (
        <div className="list card" style={{ marginBottom: 28 }}>
          {asked.map((q) => (
            <QuestionRow key={q.id} qa={q} who={state.soe.find((s) => s.id === q.soe_id)?.member_id ?? null} whoLabel="For" onOpen={setEditing} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 28 }}>
          <Empty art={false}>You haven't asked anyone a question yet. Pick a submitted SOE below.</Empty>
        </div>
      )}

      <h3 className="section-title">Submitted SOEs you can ask about</h3>
      {open.length ? (
        <div className="grid three">
          {open.map((s) => (
            <button key={s.id} className="card record-card" onClick={() => go('soe', { record: s.id })}>
              <div className="record-top">
                <Avatar member={state.members.find((m) => m.id === s.member_id)} />
                <div>
                  <strong>{name(s.member_id)}</strong>
                  <small>{s.competency}</small>
                </div>
                <ArrowUpRight size={18} className="muted" />
              </div>
              <div className="record-foot">
                <span>{questionCount(state.qa.filter((q) => q.soe_id === s.id).length)}</span>
                {(() => {
                  const mineHere = state.qa.filter((q) => q.soe_id === s.id && q.asked_by === me.memberId && q.level).length;
                  return mineHere >= 3 ? (
                    <span className="badge green">You asked all 3</span>
                  ) : (
                    <span className="link-btn">
                      <MessageCircleQuestion size={16} /> {mineHere ? `Asked ${mineHere} of 3` : 'Ask 3 questions'}
                    </span>
                  );
                })()}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="card">
          <Empty art={false}>No one else has submitted an SOE yet.</Empty>
        </div>
      )}

      {editing && <QaEditor qa={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

export function questionCount(n: number) {
  return n ? `${n} ${n === 1 ? 'question' : 'questions'}` : 'No questions yet';
}

function QuestionRow({ qa, who, whoLabel, onOpen }: { qa: Qa; who: string | null; whoLabel: string; onOpen: (qa: Qa) => void }) {
  const { state, member, label } = useHub();
  const soe = state.soe.find((s) => s.id === qa.soe_id);
  return (
    <button className="list-item" onClick={() => onOpen(qa)}>
      <Avatar member={member(who)} />
      <div>
        <strong className="clamp" style={{ WebkitLineClamp: 2 }}>
          {qa.question}
        </strong>
        <small>
          {qa.level ? `Level ${qa.level} · ` : ''}
          {soe?.competency} · {whoLabel} {who ? label(who) : 'a former member'} · {ago(qa.updated_at)}
        </small>
        <span className="qa-row-status">
          {answered(qa) ? <StatusBadge status={qa.status} /> : <span className="badge yellow">Waiting for answer</span>}
        </span>
      </div>
    </button>
  );
}

const LEVEL_TITLES = ['', 'Knowledge and understanding', 'Application of knowledge', 'Reasoned advice'];
const LEVELS = [1, 2, 3] as const;

// The question thread inside an SOE record. Every other candidate asks one question per level.
export function SoeQuestions({ soe }: { soe: SoeSummary }) {
  const { state, me, name } = useHub();
  const [editing, setEditing] = useState<Qa | null>(null);
  const mine = soe.member_id === me.memberId;
  const questions = state.qa.filter((q) => q.soe_id === soe.id).sort((a, b) => a.number - b.number);
  const askers = state.members.filter((m) => m.status === 'Active' && m.id !== soe.member_id).length;
  const unlevelled = questions.filter((q) => !q.level);

  return (
    <section className="soe-level">
      <h3>Questions from the group</h3>
      {!soe.submitted_at ? (
        <p className="note">
          {mine
            ? 'Submit your SOE and every other candidate asks you one question on each level.'
            : `Once ${name(soe.member_id)} submits this SOE, you ask them one question on each level here.`}
        </p>
      ) : (
        <p className="muted small">
          {mine
            ? 'Every other candidate asks you one question on each level. You get an alert for each one; answer them here.'
            : `Ask ${name(soe.member_id)} one question on each level. They get an alert and answer here.`}
        </p>
      )}

      {soe.submitted_at &&
        LEVELS.map((level) => {
          const here = questions.filter((q) => q.level === level);
          const askedByMe = here.some((q) => q.asked_by === me.memberId);
          return (
            <div key={level} className="qa-level">
              <div className="qa-level-head">
                <span className="eyebrow">
                  Level {level} · {LEVEL_TITLES[level]}
                </span>
                <small className="muted">
                  {here.length} of {askers} asked
                </small>
              </div>
              {here.map((q) => (
                <QuestionItem key={q.id} qa={q} soe={soe} onEdit={setEditing} />
              ))}
              {!mine && !askedByMe && <AskBox soe={soe} level={level} />}
              {!here.length && mine && <p className="muted small qa-wait">No Level {level} questions yet.</p>}
            </div>
          );
        })}
      {unlevelled.map((q) => (
        <QuestionItem key={q.id} qa={q} soe={soe} onEdit={setEditing} />
      ))}
      {editing && <QaEditor qa={editing} onClose={() => setEditing(null)} inSoe />}
    </section>
  );
}

function AskBox({ soe, level }: { soe: SoeSummary; level: 1 | 2 | 3 }) {
  const hub = useHub();
  const { name, reload } = hub;
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    const ok = await attempt(
      hub,
      async () => {
        await api('/api/qa', { body: { soe_id: soe.id, level, question: draft } });
        await reload();
      },
      `Question sent. ${name(soe.member_id)} has been notified.`,
    );
    setBusy(false);
    if (ok) setDraft('');
  }

  return (
    <div className="qa-ask">
      <textarea
        className="input"
        rows={2}
        maxLength={4000}
        value={draft}
        disabled={busy}
        aria-label={`Your Level ${level} question for ${name(soe.member_id)}`}
        placeholder={`Your Level ${level} question for ${name(soe.member_id)}…`}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="row end">
        <button className="btn primary small" onClick={ask} disabled={busy || !draft.trim()}>
          <Send size={16} /> {busy ? 'Sending…' : 'Send question'}
        </button>
      </div>
    </div>
  );
}

function QuestionItem({ qa: q, soe, onEdit }: { qa: Qa; soe: SoeSummary; onEdit: (qa: Qa) => void }) {
  const { me, name, label, member } = useHub();
  const mine = soe.member_id === me.memberId;
  const done = answered(q);
  const isAsker = q.asked_by === me.memberId;
  return (
    <article className="qa-item">
      <div className="qa-q">
        <Avatar member={member(q.asked_by)} />
        <div>
          <p>{q.question}</p>
          <small className="muted">
            {isAsker ? 'You asked' : `Asked by ${q.asked_by ? label(q.asked_by) : 'a former member'}`} · {ago(q.updated_at)}
          </small>
        </div>
      </div>
      {done ? (
        <div className="qa-a">
          {PARTS.filter((p) => q[p.key].trim()).map((p) => (
            <div key={p.key}>
              <span className="eyebrow">{p.label}</span>
              <p>{q[p.key]}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted small qa-wait">{mine ? 'Waiting for your answer.' : `Waiting for ${name(soe.member_id)} to answer.`}</p>
      )}
      {q.feedback.trim() && (
        <div className="qa-a">
          <span className="eyebrow">Feedback</span>
          <p>{q.feedback}</p>
        </div>
      )}
      <div className="row">
        {done && <StatusBadge status={q.status} />}
        <span className="spacer" />
        <button className={'btn small' + (mine && !done ? ' primary' : '')} onClick={() => onEdit(q)}>
          <PenLine size={15} /> {mine ? (done ? 'Edit answer' : 'Answer') : isAsker ? 'Edit or add feedback' : 'Add feedback'}
        </button>
      </div>
    </article>
  );
}

export function QaEditor({ qa, onClose, inSoe }: { qa: Qa; onClose: () => void; inSoe?: boolean }) {
  const hub = useHub();
  const { state, me, name, label, reload, go } = hub;
  const soe = state.soe.find((s) => s.id === qa.soe_id);
  const isAsker = qa.asked_by === me.memberId;
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
      hub.toast(isCandidate && !answered(qa) && answered(draft) ? `Answer saved. ${qa.asked_by ? name(qa.asked_by) : 'The asker'} has been notified.` : 'Saved.');
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
      title={`${qa.level ? `Level ${qa.level} question` : `Question ${qa.number}`} · ${soe?.competency ?? ''}`}
      subtitle={`For ${soe ? label(soe.member_id) : ''} · asked by ${qa.asked_by ? label(qa.asked_by) : 'a former member'}`}
      footer={
        <>
          {(isAsker || me.isLeader) && (
            <button
              className="btn danger"
              disabled={busy}
              onClick={() => {
                if (!confirm('Remove this question and its answer?')) return;
                attempt(
                  hub,
                  async () => {
                    await api('/api/qa', { method: 'DELETE', body: { id: qa.id } });
                    await reload();
                    onClose();
                  },
                  'Question removed.',
                );
              }}
            >
              <Trash2 size={16} /> Remove
            </button>
          )}
          {soe && !inSoe && (
            <button className="btn" onClick={() => go('soe', { record: soe.id })} disabled={busy}>
              View SOE <ArrowUpRight size={16} />
            </button>
          )}
          <span className="spacer" />
          <button className="btn primary" onClick={save} disabled={busy || !draft.question.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="form">
        <p className="note wide">
          {isCandidate
            ? 'Answer in four parts. The person who asked gets an alert when you first answer.'
            : isAsker
              ? `You asked this. ${name(soe?.member_id)} writes the answer. You can reword your question and add feedback.`
              : `${name(soe?.member_id)} answers this question. You can add feedback.`}
        </p>
        <Field label="Question" wide>
          <textarea rows={3} maxLength={4000} value={draft.question} disabled={!isAsker} onChange={(e) => set('question', e.target.value)} />
        </Field>
        {PARTS.map((part) =>
          isCandidate || draft[part.key].trim() ? (
            <Field key={part.key} label={part.label} hint={isCandidate ? part.hint : undefined} wide>
              <textarea rows={4} maxLength={8000} value={draft[part.key]} disabled={!isCandidate} onChange={(e) => set(part.key, e.target.value)} />
            </Field>
          ) : null,
        )}
        {!isCandidate && !answered(draft) && <p className="muted small wide">Not answered yet.</p>}
        <Field label="Feedback and comments" wide>
          <textarea rows={3} maxLength={8000} value={draft.feedback} onChange={(e) => set('feedback', e.target.value)} />
        </Field>
        {(isAsker || isCandidate) && (
          <Field label="Status">
            <Select value={draft.status} onChange={(v) => set('status', v)} options={[...REVIEW_STATUSES]} />
          </Field>
        )}
        {error && <p className="error wide">{error}</p>}
      </div>
    </Sheet>
  );
}

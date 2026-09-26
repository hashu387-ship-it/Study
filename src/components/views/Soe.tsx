'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BookOpen, Check, MessageCircleQuestion, Plus, Send, Trash2 } from 'lucide-react';
import { api, uploadFile } from '@/lib/client/api';
import { fmtDateTime } from '@/lib/time';
import { COMPETENCIES, REVIEW_STATUSES, type SoeFull, type SoeSummary } from '@/lib/types';
import { attempt, useHub } from '../hub';
import { Avatar, Empty, Field, PageHead, Select, Sheet, StatusBadge } from '../ui';
import { SoeLevel } from './SoeLevel';

export function Soe() {
  const hub = useHub();
  const { state, me, params, member, name } = hub;
  const competencies = useMemo(() => [...new Set(state.soe.map((s) => s.competency))], [state.soe]);
  const [competency, setCompetency] = useState('all');
  const [candidate, setCandidate] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const record = params.get('record');
    if (record && state.soe.some((s) => s.id === record)) setOpenId(record);
  }, [params]);

  const shown = state.soe.filter(
    (s) => (competency === 'all' || s.competency === competency) && (candidate === 'all' || s.member_id === candidate),
  );

  return (
    <>
      <PageHead
        eyebrow="Statements of experience"
        title="SOE register"
        text="Each candidate adds their Level 1 to 3 evidence per competency. Upload a document or photo, or paste your text. The group is notified when you submit."
        action={
          <button className="btn primary" onClick={() => setAdding(true)}>
            <Plus size={18} /> Add competency
          </button>
        }
      />

      <div className="chips" role="group" aria-label="Filter by competency">
        <button className="chip" aria-pressed={competency === 'all'} onClick={() => setCompetency('all')}>
          All competencies
        </button>
        {competencies.map((c) => (
          <button key={c} className="chip" aria-pressed={competency === c} onClick={() => setCompetency(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <Field label="Candidate">
          <Select
            value={candidate}
            onChange={setCandidate}
            options={[
              { value: 'all', label: 'Everyone' },
              { value: me.memberId, label: `Me (${me.name})` },
              ...state.members.filter((m) => m.id !== me.memberId).map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
        </Field>
      </div>

      <div className="grid three">
        {shown.map((s) => (
          <button key={s.id} className="card record-card" onClick={() => setOpenId(s.id)}>
            <div className="record-top">
              <Avatar member={member(s.member_id)} />
              <div>
                <strong>{name(s.member_id)}</strong>
                <small>{s.competency}</small>
              </div>
              <ArrowUpRight size={18} className="muted" />
            </div>
            <div className="levels">
              {s.words.map((w, i) => (
                <span key={i} className={'level-pill' + (w ? ' done' : '')}>
                  {w ? <Check size={12} /> : null}L{i + 1}
                </span>
              ))}
            </div>
            <div className="record-foot">
              <StatusBadge status={s.status} />
              <span>{s.questioner_id ? `Questioner: ${name(s.questioner_id)}` : 'No questioner yet'}</span>
            </div>
            {s.member_id === me.memberId && !s.words.every((w) => w) && <span className="badge yellow">Yours · add your SOE</span>}
          </button>
        ))}
      </div>
      {!shown.length && (
        <div className="card">
          <Empty icon={<BookOpen size={30} />}>No SOE records match these filters.</Empty>
        </div>
      )}

      {openId && <SoeEditor summary={state.soe.find((s) => s.id === openId)} onClose={() => setOpenId(null)} />}
      <AddCompetency open={adding} onClose={() => setAdding(false)} existing={state.soe} />
    </>
  );
}

function SoeEditor({ summary, onClose }: { summary: SoeSummary | undefined; onClose: () => void }) {
  const hub = useHub();
  const { state, me, name, reload, go } = hub;
  const [record, setRecord] = useState<SoeFull | null>(null);
  const [texts, setTexts] = useState<[string, string, string]>(['', '', '']);
  const [pending, setPending] = useState<[File | null, File | null, File | null]>([null, null, null]);
  const [details, setDetails] = useState({ competency_type: 'Technical', questioner_id: '', status: 'Not Started', notes: '' });
  const [busy, setBusy] = useState<'submit' | 'details' | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    if (!summary) return;
    const full = await api<SoeFull>(`/api/soe/${summary.id}`);
    setRecord(full);
    setTexts([full.level1, full.level2, full.level3]);
    setPending([null, null, null]);
    setDetails({ competency_type: full.competency_type, questioner_id: full.questioner_id ?? '', status: full.status, notes: full.notes });
  };

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, [summary?.id]);

  if (!summary) return null;
  const mine = summary.member_id === me.memberId;
  const canDelete = mine || me.isLeader;
  const dirty = record && (texts[0] !== record.level1 || texts[1] !== record.level2 || texts[2] !== record.level3 || pending.some(Boolean));
  const questions = state.qa.filter((q) => q.soe_id === summary.id);

  async function submit() {
    if (!record) return;
    setBusy('submit');
    setError('');
    try {
      const fileIds = await Promise.all(pending.map((file) => (file ? uploadFile(file, 'soe') : Promise.resolve(null))));
      await api(`/api/soe/${record.id}/submit`, {
        body: { revision: record.revision, levels: texts.map((text, i) => ({ text, fileId: fileIds[i] })) },
      });
      await Promise.all([reload(), load()]);
      hub.toast('SOE submitted. The group has been notified.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function saveDetails() {
    if (!record) return;
    setBusy('details');
    setError('');
    try {
      await api(`/api/soe/${record.id}`, {
        method: 'PATCH',
        body: { ...details, questioner_id: details.questioner_id || null, revision: record.revision },
      });
      await Promise.all([reload(), load()]);
      hub.toast('Details saved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet
      open
      onClose={() => {
        if (dirty && !confirm('You have unsubmitted SOE changes. Close anyway?')) return;
        onClose();
      }}
      busy={busy !== null}
      title={summary.competency}
      subtitle={`${name(summary.member_id)} · ${summary.competency_type}${record?.submitted_at ? ` · last submitted ${fmtDateTime(record.submitted_at)}` : ''}`}
      footer={
        <>
          {canDelete && (
            <button
              className="btn danger"
              disabled={busy !== null}
              onClick={() => {
                if (!confirm('Remove this competency and its practice questions?')) return;
                attempt(
                  hub,
                  async () => {
                    await api(`/api/soe/${summary.id}`, { method: 'DELETE' });
                    await reload();
                    onClose();
                  },
                  'Competency removed.',
                );
              }}
            >
              <Trash2 size={17} /> Remove
            </button>
          )}
          <button className="btn" onClick={() => go('qa', { soe: summary.id })} disabled={busy !== null}>
            <MessageCircleQuestion size={17} /> Questions ({questions.length})
          </button>
          <span className="spacer" />
          {mine && (
            <button className="btn primary" onClick={submit} disabled={busy !== null || !record || !dirty}>
              <Send size={17} /> {busy === 'submit' ? 'Submitting…' : 'Submit SOE and notify group'}
            </button>
          )}
        </>
      }
    >
      {!record ? (
        error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>
      ) : (
        <div className="grid" style={{ gap: 18 }}>
          {!mine && (
            <p className="note">
              Only {name(summary.member_id)} can change this SOE text. You can still set the questioner, review status and notes below.
            </p>
          )}
          {([1, 2, 3] as const).map((level) => (
            <SoeLevel
              key={level}
              level={level}
              value={texts[level - 1]}
              onChange={(text) => setTexts((all) => all.map((t, i) => (i === level - 1 ? text : t)) as [string, string, string])}
              file={record.files[level - 1]}
              pending={pending[level - 1]}
              onPending={(file) => setPending((all) => all.map((f, i) => (i === level - 1 ? file : f)) as [File | null, File | null, File | null])}
              disabled={!mine || busy !== null}
            />
          ))}

          <section className="soe-level">
            <h3>Record details</h3>
            <div className="form">
              <Field label="Competency type">
                <Select
                  value={details.competency_type}
                  onChange={(v) => setDetails({ ...details, competency_type: v })}
                  options={['Technical', 'Mandatory', 'Optional']}
                />
              </Field>
              <Field label="Questioner" hint="Writes 3 practice questions for this competency.">
                <Select
                  value={details.questioner_id}
                  onChange={(v) => setDetails({ ...details, questioner_id: v })}
                  options={[
                    { value: '', label: 'Not assigned' },
                    ...state.members.filter((m) => m.id !== summary.member_id).map((m) => ({ value: m.id, label: m.name })),
                  ]}
                />
              </Field>
              <Field label="Review status">
                <Select value={details.status} onChange={(v) => setDetails({ ...details, status: v })} options={[...REVIEW_STATUSES]} />
              </Field>
              <Field label="Group leader notes" wide>
                <textarea rows={3} maxLength={4000} value={details.notes} onChange={(e) => setDetails({ ...details, notes: e.target.value })} />
              </Field>
            </div>
            <div className="row end">
              <button className="btn small" onClick={saveDetails} disabled={busy !== null}>
                {busy === 'details' ? 'Saving…' : 'Save details'}
              </button>
            </div>
          </section>
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </Sheet>
  );
}

function AddCompetency({ open, onClose, existing }: { open: boolean; onClose: () => void; existing: SoeSummary[] }) {
  const hub = useHub();
  const { state, me, reload } = hub;
  const [memberId, setMemberId] = useState(me.memberId);
  const [choice, setChoice] = useState(COMPETENCIES[0]);
  const [custom, setCustom] = useState('');
  const [type, setType] = useState('Technical');
  const [busy, setBusy] = useState(false);
  const competency = choice === 'Other' ? custom.trim() : choice;
  const duplicate = existing.some((s) => s.member_id === memberId && s.competency.toLowerCase() === competency.toLowerCase());

  return (
    <Sheet
      open={open}
      onClose={onClose}
      busy={busy}
      title="Add a competency"
      subtitle="Creates the SOE record and three practice questions."
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={busy || !competency || duplicate}
            onClick={async () => {
              setBusy(true);
              const ok = await attempt(
                hub,
                async () => {
                  await api('/api/soe', { body: { member_id: memberId, competency, competency_type: type } });
                  await reload();
                },
                'Competency added.',
              );
              setBusy(false);
              if (ok) onClose();
            }}
          >
            <Plus size={17} /> Add
          </button>
        </>
      }
    >
      <div className="form">
        {me.isLeader && (
          <Field label="Candidate" wide>
            <Select value={memberId} onChange={setMemberId} options={state.members.map((m) => ({ value: m.id, label: m.name }))} />
          </Field>
        )}
        <Field label="Competency" wide>
          <Select value={choice} onChange={setChoice} options={[...COMPETENCIES, 'Other']} />
        </Field>
        {choice === 'Other' && (
          <Field label="Competency name" wide>
            <input value={custom} maxLength={120} onChange={(e) => setCustom(e.target.value)} />
          </Field>
        )}
        <Field label="Type">
          <Select value={type} onChange={setType} options={['Technical', 'Mandatory', 'Optional']} />
        </Field>
        {duplicate && <p className="error wide">This competency is already in the register for that candidate.</p>}
      </div>
    </Sheet>
  );
}

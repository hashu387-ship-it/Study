'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, Presentation, Upload } from 'lucide-react';
import { api, checkFile, uploadFile } from '@/lib/client/api';
import { fmtDate } from '@/lib/time';
import { PRESENTATION_STATUSES, REVIEW_STATUSES, type CaseStudy } from '@/lib/types';
import { useHub } from '../hub';
import { Avatar, Field, FileChip, PageHead, Select, Sheet, StatusBadge } from '../ui';
import { nextWorkshop, SessionWhen, WORKSHOP_TARGET } from './shared';

export function Cases() {
  const { state, me, params, member, name, go } = useHub();
  const [openId, setOpenId] = useState<string | null>(null);
  const workshop = nextWorkshop(state);
  const ready = state.cases.filter((c) => c.presentation_status === 'Ready' || c.presentation_status === 'Presented');
  const percent = Math.min(100, Math.round((ready.length / WORKSHOP_TARGET) * 100));

  useEffect(() => {
    const record = params.get('record');
    if (record && state.cases.some((c) => c.id === record)) setOpenId(record);
  }, [params]);

  const mine = state.cases.find((c) => c.member_id === me.memberId);
  const others = state.cases.filter((c) => c.member_id !== me.memberId);

  return (
    <>
      <PageHead
        eyebrow="Case studies and presentations"
        title="Case studies"
        text="Share your case study, mark your presentation as ready for the workshop, and ask each other questions."
      />

      <section className="card" style={{ marginBottom: 22 }}>
        <div className="card-head">
          <div>
            <h3>{workshop ? workshop.title : 'Presentation workshop'}</h3>
            <p>
              {workshop
                ? fmtDate(workshop.session_date, { weekday: 'long', day: 'numeric', month: 'long' })
                : 'No workshop in the calendar yet'}
            </p>
            {workshop && <SessionWhen session={workshop} />}
          </div>
          <Presentation size={26} className="muted" />
        </div>
        <div className="row" style={{ marginBottom: 10 }}>
          <strong>
            {ready.length} of {WORKSHOP_TARGET} presentations ready
          </strong>
          <span className="muted small">At least {WORKSHOP_TARGET} are needed from each group.</span>
        </div>
        <div className="progress" aria-hidden="true">
          <i style={{ width: `${percent}%` }} />
        </div>
        <div className="avatars" style={{ marginTop: 14 }}>
          {ready.map((c) => (
            <span key={c.id} className="badge green">
              {name(c.member_id)}
            </span>
          ))}
          {!ready.length && <span className="muted small">Nobody has marked their presentation ready yet.</span>}
        </div>
        {workshop && (
          <button className="link-btn" style={{ marginTop: 14 }} onClick={() => go('attendance', { session: workshop.id })}>
            Workshop attendance <ArrowUpRight size={16} />
          </button>
        )}
      </section>

      <div className="grid three">
        {[mine, ...others].filter((c): c is CaseStudy => Boolean(c)).map((c) => (
          <button key={c.id} className="card record-card" onClick={() => setOpenId(c.id)}>
            <div className="record-top">
              <Avatar member={member(c.member_id)} />
              <div>
                <strong>{name(c.member_id)}</strong>
                <small className="code">
                  {c.member_id}
                  {c.member_id === me.memberId ? ' · you' : ''}
                </small>
                <small>{c.title || 'Case study title not added yet'}</small>
              </div>
              <ArrowUpRight size={18} className="muted" />
            </div>
            <p className="small muted clamp">{c.summary || 'No summary shared yet.'}</p>
            <div className="record-foot">
              <span className="row" style={{ gap: 6 }}>
                <Presentation size={15} /> <StatusBadge status={c.presentation_status} />
              </span>
              {c.slides ? <span>Slides attached</span> : <StatusBadge status={c.status} />}
            </div>
          </button>
        ))}
      </div>

      {openId && <CaseEditor record={state.cases.find((c) => c.id === openId)!} onClose={() => setOpenId(null)} />}
    </>
  );
}

function CaseEditor({ record, onClose }: { record: CaseStudy; onClose: () => void }) {
  const hub = useHub();
  const { me, name, reload } = hub;
  const owner = record.member_id === me.memberId || me.isLeader;
  const [draft, setDraft] = useState(record);
  const [slides, setSlides] = useState<File | null>(null);
  const [removeSlides, setRemoveSlides] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof CaseStudy, value: string) => setDraft({ ...draft, [key]: value });

  async function save() {
    setBusy(true);
    setError('');
    try {
      const slidesFileId = slides ? await uploadFile(slides, 'slides') : removeSlides ? null : undefined;
      await api('/api/cases', { method: 'PATCH', body: { ...draft, slidesFileId } });
      await reload();
      hub.toast(
        draft.presentation_status === 'Ready' && record.presentation_status !== 'Ready'
          ? 'Marked ready. The group has been told.'
          : 'Saved.',
      );
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
      title={`${name(record.member_id)}'s case study`}
      subtitle={owner ? 'You can edit everything here.' : `Only ${name(record.member_id)} and the group leader can edit the case study. Anyone can add questions.`}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="form">
        <Field label="Presentation for the workshop" wide group>
          <div className="segmented">
            {PRESENTATION_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className={status === 'Ready' || status === 'Presented' ? 'present' : status === 'In progress' ? 'late' : ''}
                aria-pressed={draft.presentation_status === status}
                disabled={!owner}
                onClick={() => set('presentation_status', status)}
              >
                {status}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Slides" wide group hint="PDF or PowerPoint, up to 25 MB.">
          <div className="row">
            {slides ? (
              <FileChip file={{ name: slides.name, size: slides.size }} onRemove={() => setSlides(null)} />
            ) : record.slides && !removeSlides ? (
              <>
                <FileChip file={record.slides} />
                {owner && (
                  <button type="button" className="btn small danger" onClick={() => setRemoveSlides(true)}>
                    Remove
                  </button>
                )}
              </>
            ) : (
              <span className="muted small">No slides attached.</span>
            )}
            {owner && (
              <label className="btn small upload-label">
                <Upload size={16} /> {record.slides || slides ? 'Replace' : 'Attach slides'}
                <input
                  type="file"
                  accept=".pdf,.pptx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    const problem = checkFile(file, 'slides');
                    if (problem) return setError(problem);
                    setError('');
                    setSlides(file);
                    setRemoveSlides(false);
                  }}
                />
              </label>
            )}
          </div>
        </Field>
        <Field label="Case study title" wide>
          <input value={draft.title} maxLength={200} disabled={!owner} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Summary, or a link to the case study shared with the group" wide>
          <textarea rows={5} maxLength={8000} value={draft.summary} disabled={!owner} onChange={(e) => set('summary', e.target.value)} />
        </Field>
        <Field label="Questions from other candidates" wide hint="Anyone can add questions here. Put your name next to yours.">
          <textarea rows={5} maxLength={8000} value={draft.questions} onChange={(e) => set('questions', e.target.value)} />
        </Field>
        <Field label="Review status">
          <Select value={draft.status} onChange={(v) => set('status', v)} options={[...REVIEW_STATUSES]} disabled={!owner} />
        </Field>
        <Field label="Group leader notes" wide>
          <textarea rows={3} maxLength={4000} value={draft.notes} disabled={!owner} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        {error && <p className="error wide">{error}</p>}
      </div>
    </Sheet>
  );
}

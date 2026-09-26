'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import type { View } from './hub';
import { AlertArt, AttendanceArt, PickNameArt, QaArt, SessionArt, SoeArt } from './illustrations';
import { Sheet } from './ui';

export const TOUR_KEY = 'g03-tour-done';

export const STEPS: { title: string; text: string; art: (p: { size?: number }) => ReactNode; view: View }[] = [
  {
    title: 'You are in',
    text: 'You picked your name, so everything you post and submit carries it. You can switch at any time from the top bar.',
    art: PickNameArt,
    view: 'overview',
  },
  {
    title: 'Add your SOE',
    text: 'In the SOE register, open your competency and upload a PDF, Word file or photo, or paste your text. Check the converted text, then submit. The group is told.',
    art: SoeArt,
    view: 'soe',
  },
  {
    title: 'Ask and answer',
    text: 'Once someone submits their SOE, open it and ask them a question. When the group asks about yours, you get an alert and answer in four parts.',
    art: QaArt,
    view: 'qa',
  },
  {
    title: 'Join the sessions',
    text: 'Sunday, Tuesday and Wednesday, 8:00 – 9:30 pm GST. Tap Join on Teams from Home or the calendar. Times show in your own zone too.',
    art: SessionArt,
    view: 'calendar',
  },
  {
    title: 'Be counted',
    text: 'The attendance register shows who joined each session. Mark yourself, or anyone who was there.',
    art: AttendanceArt,
    view: 'attendance',
  },
  {
    title: 'Never miss an update',
    text: 'Turn on alerts once on each phone to hear about announcements, new posts and session reminders. On iPhone, add the app to your Home Screen first.',
    art: AlertArt,
    view: 'alerts',
  },
];

export function tourDone() {
  try {
    return localStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return true;
  }
}

export function Walkthrough({ open, onClose, onGo }: { open: boolean; onClose: () => void; onGo: (view: View) => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);
  const finish = () => {
    try {
      localStorage.setItem(TOUR_KEY, '1');
    } catch {}
    onClose();
  };
  const s = STEPS[step];
  const Art = s.art;
  const last = step === STEPS.length - 1;
  return (
    <Sheet
      open={open}
      onClose={finish}
      title={s.title}
      subtitle={`Step ${step + 1} of ${STEPS.length}`}
      footer={
        <>
          <button className="btn" onClick={finish}>
            Skip
          </button>
          <span className="spacer" />
          {step > 0 && (
            <button className="btn" onClick={() => setStep(step - 1)} aria-label="Previous step">
              <ArrowLeft size={16} />
            </button>
          )}
          <button
            className="btn primary"
            onClick={() => {
              if (!last) return setStep(step + 1);
              finish();
              onGo('overview');
            }}
          >
            {last ? 'Start' : 'Next'} <ArrowRight size={16} />
          </button>
        </>
      }
    >
      <div className="tour" key={step}>
        <Art size={260} />
        <p>{s.text}</p>
        <div className="tour-dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <i key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>
      </div>
    </Sheet>
  );
}

// A small illustrated hint at the top of a section. Closing it hides it on this device.
export function Tip({ id, art: Art, title, children }: { id: string; art: (p: { size?: number }) => ReactNode; title: string; children: ReactNode }) {
  const key = `g03-tip-${id}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === '1');
    } catch {
      setHidden(false);
    }
  }, [key]);
  if (hidden) return null;
  return (
    <aside className="tip" aria-label={`Tip: ${title}`}>
      <Art size={120} />
      <div>
        <div className="eyebrow">How this works</div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
      <button
        className="icon-btn"
        aria-label="Hide this tip"
        onClick={() => {
          try {
            localStorage.setItem(key, '1');
          } catch {}
          setHidden(true);
        }}
      >
        <X size={16} />
      </button>
    </aside>
  );
}

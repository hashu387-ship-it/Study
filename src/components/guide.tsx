'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { View } from './hub';
import { AlertArt, AttendanceArt, PickNameArt, QaArt, SessionArt, SoeArt } from './illustrations';

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

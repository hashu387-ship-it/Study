'use client';

import { ArrowRight, PlayCircle } from 'lucide-react';
import { useHub } from '../hub';
import { STEPS } from '../guide';
import { CycleDiagram } from '../illustrations';
import { PageHead } from '../ui';

const CYCLE = ['Submit SOE', 'Questioner asks', 'You answer', 'Feedback', 'Session together', 'Attendance'];

export function HowItWorks({ onReplay }: { onReplay: () => void }) {
  const { go } = useHub();
  return (
    <>
      <PageHead
        eyebrow="Guide"
        title="How it works"
        text="The group runs the same cycle every week. Each step below opens the part of the app where it happens."
        action={
          <button className="btn primary" onClick={onReplay}>
            <PlayCircle size={16} /> Replay the walkthrough
          </button>
        }
      />

      <section className="card how-cycle">
        <CycleDiagram steps={CYCLE} />
        <ol className="cycle-legend">
          {CYCLE.map((step, i) => (
            <li key={step}>
              <span className="medallion">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <h3 className="section-title" style={{ marginTop: 48 }}>
        Step by step
      </h3>
      <div className="grid three">
        {STEPS.map(({ title, text, art: Art, view }) => (
          <button key={title} className="card record-card how-step" onClick={() => go(view)}>
            <Art size={200} />
            <strong>{title}</strong>
            <p className="small muted">{text}</p>
            <span className="link-btn">
              Open <ArrowRight size={14} />
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';

// Everyone's final assessment is on Sunday 1 November; the count runs to the start of that day, UAE time.
const FINAL_INTERVIEW = Date.parse('2026-11-01T00:00:00+04:00');
const DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

export function FinalCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = FINAL_INTERVIEW - now;
  if (left < -DAY) return null;

  const parts = [
    { value: Math.floor(left / DAY), label: left >= 2 * DAY || left < DAY ? 'days' : 'day' },
    { value: Math.floor((left % DAY) / 3_600_000), label: 'hours' },
    { value: Math.floor((left % 3_600_000) / 60_000), label: 'minutes' },
    { value: Math.floor((left % 60_000) / 1000), label: 'seconds' },
  ];

  return (
    <section className="countdown" aria-label="Countdown to the final interview">
      <div className="countdown-text">
        <div className="eyebrow">RICS APC final assessment</div>
        <h3>
          Final <em className="accent-word">interview</em>
        </h3>
        <p>Sunday 1 November 2026</p>
      </div>
      {left > 0 ? (
        <div className="countdown-clock" role="timer" aria-live="off">
          {parts.map((p, i) => (
            <div key={p.label} className="countdown-unit">
              <b>{i === 0 ? p.value : pad(p.value)}</b>
              <span>{p.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="countdown-today">It's interview day. Good luck, everyone.</p>
      )}
    </section>
  );
}

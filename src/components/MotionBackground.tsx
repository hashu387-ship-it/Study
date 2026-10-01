'use client';

import { useEffect, useState } from 'react';

// The drifting glass background, rendered with HeyGen HyperFrames (source in motion/glass-background).
// Phones get the portrait cut, wider screens the landscape one. Anyone who has asked their device
// for reduced motion sees the still first frame instead.
export function MotionBackground() {
  const [shape, setShape] = useState<'landscape' | 'portrait' | null>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const portrait = window.matchMedia('(orientation: portrait)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setShape(portrait.matches ? 'portrait' : 'landscape');
      setStill(calm.matches);
    };
    update();
    portrait.addEventListener('change', update);
    calm.addEventListener('change', update);
    return () => {
      portrait.removeEventListener('change', update);
      calm.removeEventListener('change', update);
    };
  }, []);

  if (!shape) return null;
  const poster = `/motion/glass-${shape}.jpg`;
  return still ? (
    <img className="motion-bg" src={poster} alt="" aria-hidden="true" />
  ) : (
    <video key={shape} className="motion-bg" poster={poster} autoPlay muted loop playsInline preload="auto" aria-hidden="true">
      <source src={`/motion/glass-${shape}.webm`} type="video/webm" />
      <source src={`/motion/glass-${shape}.mp4`} type="video/mp4" />
    </video>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';
const KEY = 'g03-theme';

function saved(): Theme | null {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

// Sun/moon button. Until someone taps it, the app follows the device's light or dark setting.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const current = (document.documentElement.dataset.theme as Theme) || (media.matches ? 'dark' : 'light');
    setTheme(current);
    const follow = () => {
      if (saved()) return;
      const next: Theme = media.matches ? 'dark' : 'light';
      apply(next);
      setTheme(next);
    };
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    apply(next);
    setTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
  }

  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <button className="icon-btn theme-toggle" onClick={toggle} aria-label={label} title={label}>
      {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}

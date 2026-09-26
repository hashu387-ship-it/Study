'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRight, GraduationCap } from 'lucide-react';
import { api } from '@/lib/client/api';
import type { Member } from '@/lib/types';
import { Avatar } from './ui';

// "Continue as who?" No login: the choice is remembered on this device and labels what you post.
export function Welcome({
  members,
  current,
  themeButton,
  onChosen,
  onBack,
  toast,
}: {
  members: Member[];
  current?: string;
  themeButton: ReactNode;
  onChosen: () => Promise<void>;
  onBack?: () => void;
  toast: (message: string, kind?: 'error') => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function choose(id: string) {
    setBusy(id);
    try {
      await api('/api/me', { body: { memberId: id } });
      await onChosen();
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="welcome">
      <div className="theme-corner">{themeButton}</div>
      <div className="welcome-card">
        <span className="brand-mark">
          <GraduationCap size={32} />
        </span>
        <div className="eyebrow">RICS Group 03 · Study Hub</div>
        <h1>Continue as who?</h1>
        <p>Pick your name to join your study circle.</p>
        <div className="member-grid">
          {members
            .filter((m) => m.status === 'Active' || m.id === current)
            .map((m) => (
              <button key={m.id} className="member-pick" onClick={() => choose(m.id)} disabled={busy !== null} aria-pressed={m.id === current}>
                <Avatar member={m} />
                <span>
                  {m.name}
                  <small>{m.is_leader ? 'Group leader' : m.id === current ? 'Current' : 'Member'}</small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
        </div>
        <p className="muted small">
          No login needed. Your choice is remembered on this device and your name appears on anything you post. You can switch at
          any time from the top bar.
        </p>
        {onBack && (
          <button className="btn" style={{ marginTop: 18 }} onClick={onBack}>
            Back to the hub
          </button>
        )}
      </div>
    </div>
  );
}

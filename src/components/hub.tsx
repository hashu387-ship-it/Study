'use client';

import { createContext, useContext } from 'react';
import type { AppState, Me, Member } from '@/lib/types';

export type View =
  | 'overview'
  | 'announcements'
  | 'calendar'
  | 'attendance'
  | 'soe'
  | 'qa'
  | 'cases'
  | 'posts'
  | 'alerts'
  | 'members'
  | 'guide';

export type Hub = {
  state: AppState;
  me: Me;
  reload: () => Promise<void>;
  go: (view: View, params?: Record<string, string>) => void;
  params: URLSearchParams;
  toast: (message: string, kind?: 'error') => void;
  member: (id: string | null | undefined) => Member | undefined;
  name: (id: string | null | undefined) => string;
  // "Mohd. Hassan · M06": how people are labelled on cards, posts and registers.
  label: (id: string | null | undefined) => string;
};

export const HubContext = createContext<Hub | null>(null);

export function useHub() {
  const hub = useContext(HubContext);
  if (!hub) throw new Error('useHub must be used inside the app');
  return hub;
}

// Wraps an async action: shows its error as a toast and returns whether it succeeded.
export async function attempt(hub: Pick<Hub, 'toast'>, action: () => Promise<unknown>, success?: string) {
  try {
    await action();
    if (success) hub.toast(success);
    return true;
  } catch (error) {
    hub.toast((error as Error).message || 'Something went wrong.', 'error');
    return false;
  }
}

import { api } from './api';

export type PushSupport = 'supported' | 'needs-install' | 'unsupported';

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'supported';
  // iPhones only allow push from an app added to the Home Screen.
  if (ios && !standalone) return 'needs-install';
  return 'unsupported';
}

export async function registerWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

export async function currentSubscription() {
  if (pushSupport() !== 'supported') return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  return (await registration?.pushManager.getSubscription()) ?? null;
}

function keyBytes(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export async function enablePush() {
  if (pushSupport() === 'needs-install') {
    throw new Error('On iPhone, first add this site to your Home Screen (Share, then Add to Home Screen), open it from there, and turn alerts on.');
  }
  if (pushSupport() !== 'supported') throw new Error('This browser does not support alerts. Try Chrome, Edge, Firefox or Safari.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Alerts are blocked for this site. You can allow them in your browser settings.');
  const config = await api<{ publicKey: string; configured: boolean }>('/api/push');
  if (!config.configured) throw new Error('Alerts are not set up on the server yet.');
  const registration = (await registerWorker()) ?? (await navigator.serviceWorker.ready);
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) }));
  await api('/api/push', { body: subscription.toJSON() });
}

export async function disablePush() {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await api('/api/push', { method: 'DELETE', body: { endpoint: subscription.endpoint } });
  await subscription.unsubscribe();
}

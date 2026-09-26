import 'server-only';
import { cookies } from 'next/headers';
import { db, maybe, must } from './db';
import { fail } from './http';
import type { Me } from '@/lib/types';

// "Continue as" is attribution, not authentication: the group chose an open app with no login.
const MEMBER_COOKIE = 'g03_member';
const DEVICE_COOKIE = 'g03_device';
const YEAR = 60 * 60 * 24 * 365;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: YEAR,
  };
}

export async function deviceId() {
  const value = (await cookies()).get(DEVICE_COOKIE)?.value;
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export async function currentMember(): Promise<Me | null> {
  const memberId = (await cookies()).get(MEMBER_COOKIE)?.value;
  if (!memberId || !/^M\d{2,3}$/.test(memberId)) return null;
  const member = maybe(
    await db().from('members').select('id,name,is_leader,status').eq('id', memberId).maybeSingle(),
  );
  if (!member) return null;
  return { memberId: member.id, name: member.name, isLeader: member.is_leader };
}

export async function requireMember() {
  const me = await currentMember();
  if (!me) fail('Choose your name first.', 401);
  return me;
}

export async function chooseMember(memberId: string) {
  const jar = await cookies();
  jar.set(MEMBER_COOKIE, memberId, cookieOptions());
  if (!(await deviceId())) jar.set(DEVICE_COOKIE, crypto.randomUUID(), cookieOptions());
}

export async function forgetMember() {
  (await cookies()).delete(MEMBER_COOKIE);
}

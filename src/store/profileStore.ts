import { atom } from 'nanostores';

export type SessionMode = 'db' | 'local';

export interface Session {
  profileId: number;
  email: string;
  mode: SessionMode;
}

export const $session = atom<Session | null>(null);
export const $showProfilePicker = atom<boolean>(false);

const SESSION_KEY = 'panini-session';

export function loadSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  $session.set(session);
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
  $session.set(null);
}

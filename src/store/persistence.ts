import type { Session } from './profileStore';
import { $session, saveSession } from './profileStore';
import { $hydrated, $owned, $repeats } from './collectionStore';

let _importing = false;

export async function initPersistence(session: Session): Promise<void> {
  if (typeof window === 'undefined' || $hydrated.get()) return;

  // If the stored session is local-mode, re-check with the server in case
  // the DB is now available (env var added after initial session was saved).
  let activeSession = session;
  if (session.mode === 'local') {
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.email }),
      });
      if (res.ok) {
        const fresh = await res.json();
        if (fresh.mode === 'db' && fresh.profileId > 0) {
          // DB is now available — upgrade the session
          saveSession(fresh);
          activeSession = fresh;
        }
      }
    } catch {
      // Network error — keep local session
    }
  }

  if (activeSession.mode === 'db' && activeSession.profileId > 0) {
    console.log('[persistence] DB mode, loading profileId', activeSession.profileId, 'email', activeSession.email);
    // Load from DB
    let dbOwned: Record<string, boolean> = {};
    let dbRepeats: Record<string, number> = {};

    try {
      const res = await fetch(`/api/stickers?profileId=${activeSession.profileId}`);
      if (res.ok) {
        const data = await res.json();
        dbOwned = data.owned ?? {};
        dbRepeats = data.repeats ?? {};
        console.log('[persistence] Loaded from DB:', Object.keys(dbOwned).length, 'owned,', Object.keys(dbRepeats).length, 'repeats');
      } else {
        console.warn('[persistence] DB load returned status', res.status);
      }
    } catch (err) {
      console.warn('[persistence] Failed to load from DB:', err);
    }

    // If DB returned nothing but localStorage has data (migration scenario), upload it
    const localKey = `panini-collection-${activeSession.email}`;
    const hasDbData = Object.keys(dbOwned).length > 0 || Object.keys(dbRepeats).length > 0;
    if (!hasDbData) {
      try {
        const raw = localStorage.getItem(localKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const localOwned: Record<string, boolean> = parsed.owned ?? {};
          const localRepeats: Record<string, number> = parsed.repeats ?? {};
          const hasLocalData = Object.keys(localOwned).length > 0 || Object.keys(localRepeats).length > 0;
          if (hasLocalData) {
            console.log('[persistence] Migrating localStorage data to DB…');
            dbOwned = localOwned;
            dbRepeats = localRepeats;
            // Push local data up to DB
            await fetch('/api/collection', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ profileId: activeSession.profileId, owned: dbOwned, repeats: dbRepeats }),
            });
            // Clean up localStorage after migration
            localStorage.removeItem(localKey);
          }
        }
      } catch {
        // localStorage unavailable — proceed with empty
      }
    }

    $owned.set(dbOwned);
    $repeats.set(dbRepeats);
    $hydrated.set(true);

    $owned.subscribe((owned, changedKey) => {
      if (_importing || !changedKey || !$hydrated.get()) return;
      const pid = $session.get()?.profileId;
      if (!pid || pid < 0) return;
      console.log('[persistence] saving', changedKey, '→ owned', owned[changedKey], 'profileId', pid);
      fetch('/api/collection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: pid, stickerNumber: changedKey, owned: owned[changedKey] ?? false, repeats: $repeats.get()[changedKey] ?? 0 }),
      })
        .then((r) => r.json())
        .then((j) => console.log('[persistence] save result for', changedKey, j))
        .catch((e) => console.warn('[persistence] PATCH failed for', changedKey, e));
    });

    $repeats.subscribe((repeats, changedKey) => {
      if (_importing || !changedKey || !$hydrated.get()) return;
      const pid = $session.get()?.profileId;
      if (!pid || pid < 0) return;
      console.log('[persistence] saving', changedKey, '→ repeats', repeats[changedKey], 'profileId', pid);
      fetch('/api/collection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: pid, stickerNumber: changedKey, owned: $owned.get()[changedKey] ?? false, repeats: repeats[changedKey] ?? 0 }),
      })
        .then((r) => r.json())
        .then((j) => console.log('[persistence] save result for', changedKey, j))
        .catch((e) => console.warn('[persistence] PATCH failed for', changedKey, e));
    });
  } else {
    // True local mode — DB genuinely unavailable
    const key = `panini-collection-${activeSession.email}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        $owned.set(parsed.owned ?? {});
        $repeats.set(parsed.repeats ?? {});
      }
    } catch {}
    $hydrated.set(true);

    const save = () => {
      if (_importing || !$hydrated.get()) return;
      localStorage.setItem(key, JSON.stringify({ owned: $owned.get(), repeats: $repeats.get() }));
    };
    $owned.subscribe(save);
    $repeats.subscribe(save);
  }
}

export function resetPersistence(): void {
  $hydrated.set(false);
  $owned.set({});
  $repeats.set({});
}

export async function importCollection(
  owned: Record<string, boolean>,
  repeats: Record<string, number>,
): Promise<void> {
  _importing = true;
  $owned.set(owned);
  $repeats.set(repeats);
  _importing = false;

  const session = $session.get();
  if (!session) return;

  if (session.mode === 'db' && session.profileId > 0) {
    await fetch('/api/collection', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: session.profileId, owned, repeats }),
    });
  } else {
    const key = `panini-collection-${session.email}`;
    localStorage.setItem(key, JSON.stringify({ owned, repeats }));
  }
}

export async function resetCollection(): Promise<void> {
  await importCollection({}, {});
}

import type { Session } from './profileStore';
import { $session } from './profileStore';
import { $hydrated, $owned, $repeats } from './collectionStore';

let _importing = false;

export async function initPersistence(session: Session): Promise<void> {
  if (typeof window === 'undefined' || $hydrated.get()) return;

  if (session.mode === 'db' && session.profileId > 0) {
    try {
      const res = await fetch(`/api/stickers?profileId=${session.profileId}`);
      const data = await res.json();
      $owned.set(data.owned ?? {});
      $repeats.set(data.repeats ?? {});
    } catch {
      $owned.set({});
      $repeats.set({});
    }
    $hydrated.set(true);

    $owned.subscribe((owned, changedKey) => {
      if (_importing || !changedKey || !$hydrated.get()) return;
      const pid = $session.get()?.profileId;
      if (!pid || pid < 0) return;
      fetch('/api/collection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: pid, stickerNumber: changedKey, owned: owned[changedKey] ?? false, repeats: $repeats.get()[changedKey] ?? 0 }),
      });
    });

    $repeats.subscribe((repeats, changedKey) => {
      if (_importing || !changedKey || !$hydrated.get()) return;
      const pid = $session.get()?.profileId;
      if (!pid || pid < 0) return;
      fetch('/api/collection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: pid, stickerNumber: changedKey, owned: $owned.get()[changedKey] ?? false, repeats: repeats[changedKey] ?? 0 }),
      });
    });
  } else {
    // Local mode — namespace by email
    const key = `panini-collection-${session.email}`;
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
      if (_importing) return;
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

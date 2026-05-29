import type { Session } from './profileStore';
import { $session } from './profileStore';
import { $hydrated, $owned, $repeats } from './collectionStore';

let _importing = false;

export async function initPersistence(session: Session): Promise<void> {
  if (typeof window === 'undefined' || $hydrated.get()) return;
  if (!session || session.profileId <= 0) return;

  try {
    const res = await fetch(`/api/stickers?profileId=${session.profileId}`);
    const data = await res.json();
    $owned.set(data.owned ?? {});
    $repeats.set(data.repeats ?? {});
    console.log('[persistence] Loaded', Object.keys(data.owned ?? {}).length, 'owned for profileId', session.profileId);
  } catch (err) {
    console.error('[persistence] Failed to load from DB:', err);
    $owned.set({});
    $repeats.set({});
  }
  $hydrated.set(true);

  const patch = (stickerNumber: string) => {
    const pid = $session.get()?.profileId;
    if (!pid || pid <= 0) return;
    fetch('/api/collection', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true, // survive page reload/navigation so the save isn't cancelled
      body: JSON.stringify({
        profileId: pid,
        stickerNumber,
        owned: $owned.get()[stickerNumber] ?? false,
        repeats: $repeats.get()[stickerNumber] ?? 0,
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) console.error('[persistence] save failed for', stickerNumber, j);
      })
      .catch((e) => console.error('[persistence] PATCH error for', stickerNumber, e));
  };

  $owned.subscribe((_owned, _oldOwned, changedKey) => {
    if (_importing || !changedKey || !$hydrated.get()) return;
    patch(changedKey);
  });

  $repeats.subscribe((_repeats, _oldRepeats, changedKey) => {
    if (_importing || !changedKey || !$hydrated.get()) return;
    patch(changedKey);
  });
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
  if (!session || session.profileId <= 0) return;

  await fetch('/api/collection', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: session.profileId, owned, repeats }),
  });
}

export async function resetCollection(): Promise<void> {
  await importCollection({}, {});
}

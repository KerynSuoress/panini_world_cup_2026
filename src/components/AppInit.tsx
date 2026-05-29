import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $showProfilePicker, loadSession, $session } from '../store/profileStore';
import { initPersistence } from '../store/persistence';
import { $hydrated } from '../store/collectionStore';
import ProfilePicker from './ProfilePicker';

export default function AppInit() {
  const showPicker = useStore($showProfilePicker);
  const hydrated = useStore($hydrated);

  useEffect(() => {
    const session = loadSession();
    if (session) {
      $session.set(session);
      initPersistence(session);
    } else {
      $showProfilePicker.set(true);
    }
  }, []);

  if (showPicker) return <ProfilePicker />;

  // Block interaction until collection is loaded from storage/DB
  if (!hydrated) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--color-bg)]/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
          <p className="text-sm font-semibold text-[var(--color-primary)]">Loading collection…</p>
        </div>
      </div>
    );
  }

  return null;
}

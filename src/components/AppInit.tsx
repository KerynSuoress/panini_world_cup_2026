import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $showProfilePicker, loadSession, $session } from '../store/profileStore';
import { initPersistence } from '../store/persistence';
import ProfilePicker from './ProfilePicker';

export default function AppInit() {
  const showPicker = useStore($showProfilePicker);

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
  return null;
}

import { useState } from 'react';
import { saveSession, $showProfilePicker } from '../store/profileStore';
import { initPersistence } from '../store/persistence';

export default function ProfilePicker() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error();
      const session = await res.json();
      saveSession(session);
      await initPersistence(session);
      $showProfilePicker.set(false);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--color-bg)] px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <img
            src="https://cdn.worldvectorlogo.com/logos/panini-logo.svg"
            alt="Panini"
            className="h-12 w-auto"
          />
        </div>

        <h1 className="mb-2 text-center text-2xl font-black text-[var(--color-primary)]">
          FIFA World Cup 2026
        </h1>
        <p className="mb-8 text-center text-sm text-gray-500">
          Enter your email to access your sticker collection
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            autoFocus
            required
            className="w-full rounded-2xl border border-gray-200 bg-white/80 px-4 py-3 text-sm shadow-sm outline-none transition-all placeholder:text-gray-400 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
          />

          {error && (
            <p className="text-center text-xs text-[var(--color-accent-red)]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full rounded-2xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Connecting…' : 'Open my collection'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          No password needed — your email is your key.
        </p>
      </div>
    </div>
  );
}

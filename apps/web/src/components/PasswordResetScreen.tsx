import { FormEvent, useState } from 'react';
import { Button, Input, Panel } from '@maas/ui';
import { supabase } from '../lib/supabase';

export function PasswordResetScreen({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return setMessage('Supabase is not configured.');
    if (password.length < 6) return setMessage('Password must be at least 6 characters.');
    if (password !== confirmation) return setMessage('Passwords do not match.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMessage(error.message);
    await supabase.auth.signOut();
    onComplete();
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Panel className="w-full max-w-md" padded>
        <p className="font-display text-2xl font-semibold text-ink">Set a new password</p>
        <p className="mt-1 mb-6 text-sm text-ink-muted">Your reset link is valid. Choose a new password to continue.</p>
        <form onSubmit={submit} className="space-y-3">
          <Input label="New password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
          <Input label="Confirm new password" name="confirmation" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={6} required />
          {message && <p className="rounded-md bg-rust-50 p-3 text-sm text-rust-dark">{message}</p>}
          <Button fullWidth size="lg" type="submit" disabled={busy}>{busy ? 'Updating password...' : 'Update password'}</Button>
        </form>
      </Panel>
    </main>
  );
}
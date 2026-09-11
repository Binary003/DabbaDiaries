import { FormEvent, useEffect, useState } from 'react';
import { Button, Input, Panel } from '@maas/ui';
import { supabase } from './lib/supabase';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const client = supabase;
    if (!client) return setReady(true);
    client.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const { data: profile } = await client.from('profiles').select('role').eq('id', data.session.user.id).single();
        setAuthorized(profile?.role === 'admin');
      }
      setReady(true);
    });
  }, []);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return setError('Supabase is not configured.');
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) return setError(result.error.message);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', result.data.user.id).single();
    if (profile?.role !== 'admin') {
      await supabase.auth.signOut();
      return setError('This account does not have admin access.');
    }
    setAuthorized(true);
  };

  if (!ready) return <div className="flex min-h-screen items-center justify-center">Loading admin access...</div>;
  if (authorized) return <>{children}</>;
  return <main className="flex min-h-screen items-center justify-center px-4"><Panel className="w-full max-w-md" padded><h1 className="mb-1 font-display text-2xl font-semibold text-ink">Admin sign in</h1><p className="mb-5 text-sm text-ink-muted">Internal operations access only.</p><form onSubmit={signIn} className="space-y-3"><Input label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /><Input label="Password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />{error && <p className="text-sm text-rust">{error}</p>}<Button fullWidth type="submit">Sign in securely</Button></form></Panel></main>;
}
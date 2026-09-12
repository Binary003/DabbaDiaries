import { FormEvent, useState } from 'react';
import type { Role } from '@maas/core';
import { Button, Input, Panel } from '@maas/ui';
import { ChefHat, Eye, EyeOff, Home } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthScreenProps {
  onAuthenticated: (role: Exclude<Role, 'admin'>, isNewSignup: boolean) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [role, setRole] = useState<Exclude<Role, 'admin'>>('customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pincode, setPincode] = useState('');
  const [locality, setLocality] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'error' | 'success'>('error');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return setMessage('Supabase is not configured. Check apps/web/.env.local.');
    setBusy(true);
    setMessage('');
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { name, full_name: name, phone, pincode, locality, role },
        },
      });
    setBusy(false);
    if (result.error) return setMessage(result.error.message);
    if (mode === 'signup' && !result.data.session) {
      setMessageTone('success');
      if (result.data.user && result.data.user.identities?.length === 0) {
        setMessage('This email is already registered. Please sign in instead or use Forgot password.');
        setMessageTone('error');
        return;
      }
      return setMessage('We sent a verification email. Open its link to return here, then sign in. If you already created this account, choose Sign in instead.');
    }
    onAuthenticated(role, mode === 'signup');
  };

  const sendPasswordReset = async () => {
    if (!supabase || !email) return setMessage('Enter your email first, then choose Forgot password.');
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    setMessageTone('success');
    setMessage('If this email is registered, a password reset link has been sent. Check your inbox and spam folder.');
  };

  const switchMode = (nextMode: 'signin' | 'signup') => {
    setMode(nextMode);
    setMessage('');
    setMessageTone('error');
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-marigold-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-leaf-50 blur-3xl" />
      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-xl border border-steel/15 bg-paper-50 shadow-float lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden bg-spice p-10 text-paper lg:flex lg:flex-col lg:justify-between">
          <div><div className="mb-8 flex h-11 w-11 items-center justify-center rounded-lg bg-marigold text-white"><ChefHat size={23} /></div><p className="font-display text-4xl font-semibold leading-tight">Good food still feels like home.</p><p className="mt-4 max-w-xs text-sm leading-6 text-paper/75">Find trusted home cooks nearby or share the meals you make with your community.</p></div>
          <p className="text-xs text-paper/60">A calmer way to eat well, every day.</p>
        </section>
        <Panel className="rounded-none border-0 bg-transparent p-6 shadow-none sm:p-10" padded>
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2 text-spice"><Home size={17} /><span className="font-display text-xl font-semibold">DabbaDiaries</span></div>
            <p className="text-sm text-ink-muted">{mode === 'signin' ? 'Welcome back. Your next homemade meal is close.' : 'Create your account and discover food made nearby.'}</p>
          </div>
          <div className="mb-5 grid grid-cols-2 rounded-md border border-steel/20 p-1">
            {(['signin', 'signup'] as const).map((item) => (
              <button key={item} type="button" onClick={() => switchMode(item)} className={`rounded px-3 py-2 text-sm font-medium ${mode === item ? 'bg-spice text-paper' : 'text-ink-muted'}`}>
                {item === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
          {mode === 'signup' && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              {(['customer', 'cook'] as const).map((item) => (
                <button key={item} type="button" onClick={() => setRole(item)} className={`rounded-lg border p-3 text-left transition-all ${role === item ? 'border-marigold bg-marigold-50 shadow-soft' : 'border-steel/20 text-ink-muted hover:border-steel/40'}`}>
                  <span className="block text-sm font-semibold capitalize text-ink">{item === 'customer' ? 'I want meals' : 'I cook meals'}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">{item === 'customer' ? 'Browse cooks and subscribe' : 'Share your kitchen and menu'}</span>
                </button>
              ))}
            </div>
          )}
          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && <>
              <Input label="Full name" name="name" value={name} onChange={(event) => setName(event.target.value)} required />
              <Input label="Phone" name="phone" value={phone} onChange={(event) => setPhone(event.target.value)} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Pincode" name="pincode" value={pincode} onChange={(event) => setPincode(event.target.value)} required />
                <Input label="Locality" name="locality" value={locality} onChange={(event) => setLocality(event.target.value)} required />
              </div>
            </>}
            <Input label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <Input label="Password" name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} suffix={<button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>} />
            {message && <p className={`rounded-md p-3 text-sm ${messageTone === 'success' ? 'bg-leaf-50 text-leaf-dark' : 'bg-rust-50 text-rust-dark'}`}>{message}</p>}
            <Button fullWidth size="lg" type="submit" disabled={busy}>{busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}</Button>
            {mode === 'signin' && (
              <button type="button" onClick={sendPasswordReset} disabled={busy} className="w-full text-center text-sm text-ink-muted underline underline-offset-2 hover:text-ink">
                Forgot password?
              </button>
            )}
            {mode === 'signup' && (
              <button type="button" onClick={() => switchMode('signin')} className="w-full text-center text-sm text-ink-muted underline underline-offset-2 hover:text-ink">
                Already have an account? Sign in instead
              </button>
            )}
          </form>
        </Panel>
      </div>
    </main>
  );
}
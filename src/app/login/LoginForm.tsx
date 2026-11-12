'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Mode = 'signup' | 'signin';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/dashboard';
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signin' ? 'signin' : 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get('error') ? 'That sign-in link expired. Try again.' : null);
  const [sent, setSent] = useState<string | null>(null);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const supabase = createClient();
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } });
      setBusy(false);
      if (error) { setError(error.message); return; }
      if (data.session) { router.push(next); router.refresh(); return; }
      setSent(`We sent a link to ${email}. Open it to finish signing up.`);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { setError('That email and password don’t match. Try again or use a sign-in link.'); return; }
      router.push(next); router.refresh();
    }
  };

  const magicLink = async () => {
    if (!email) { setError('Type your email first, then tap the link option.'); return; }
    setBusy(true); setError(null);
    const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setSent(`We sent a sign-in link to ${email}.`);
  };

  if (sent) return <div className="auth-body"><h1>Check your email</h1><p className="muted">{sent}</p><button className="btn" type="button" onClick={() => setSent(null)}>Back</button></div>;

  return (
    <form className="auth-body" onSubmit={submit}>
      <h1>{mode === 'signup' ? 'Make your free account' : 'Welcome back'}</h1>
      <p className="muted">{mode === 'signup' ? 'Every new account gets 14 days of Pro. No credit card needed.' : 'Sign in to edit your codes and see your scans.'}</p>
      <label className="f" htmlFor="email"><span>Email</span><input id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="f" htmlFor="password"><span>Password</span><input id="password" type="password" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn primary" type="submit" disabled={busy}>{busy ? 'One moment…' : mode === 'signup' ? 'Sign up free' : 'Sign in'}</button>
      {mode === 'signin' && <button className="btn ghost" type="button" onClick={magicLink} disabled={busy}>Email me a sign-in link instead</button>}
      <p className="muted switch">
        {mode === 'signup' ? <>Already have an account? <button type="button" className="linkish" onClick={() => setMode('signin')}>Sign in</button></>
          : <>New here? <button type="button" className="linkish" onClick={() => setMode('signup')}>Make a free account</button></>}
      </p>
    </form>
  );
}

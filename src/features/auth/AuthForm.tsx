import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Building2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { backend } from '@/lib/backend';
import type { AuthOptions, SignInMethod } from '@/lib/backend/types';
import { errorMessage } from '@/lib/errors';

type Mode = 'signIn' | 'signUp';

export function AuthForm({ notice }: { notice: string | null }) {
  const [options, setOptions] = useState<AuthOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('signIn');
  const [method, setMethod] = useState<SignInMethod>('local');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice);

  useEffect(() => {
    backend()
      .authOptions()
      .then((o) => {
        setOptions(o);
        if (!o.local && o.ldap) setMethod('ldap');
      })
      .catch((e: unknown) => setOptionsError(errorMessage(e)));
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setMethod('local');
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signUp') {
        if (password.length < 8) throw new Error('Passwords must be at least 8 characters.');
        await backend().signUp(name, identifier, password);
      } else {
        await backend().signIn(method, identifier, password);
      }
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  if (optionsError) {
    return <Alert message={optionsError} />;
  }
  if (!options) {
    return <div className="flex justify-center py-12 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const ldap = mode === 'signIn' && method === 'ldap';
  const showMethodTabs = mode === 'signIn' && options.local && options.ldap;

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        {mode === 'signIn' ? 'Welcome back' : 'Create your account'}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {mode === 'signIn'
          ? 'Sign in to pick up where you left off.'
          : 'You get a private space for your own tasks straight away.'}
      </p>

      {showMethodTabs && (
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
          <MethodTab active={method === 'local'} onClick={() => setMethod('local')} icon={KeyRound} label="Workday account" />
          <MethodTab active={method === 'ldap'} onClick={() => setMethod('ldap')} icon={Building2} label="Company directory" />
        </div>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {mode === 'signUp' && (
          <div>
            <label className="label" htmlFor="auth-name">Full name</label>
            <input id="auth-name" className="input py-2.5" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} required autoFocus />
          </div>
        )}
        <div>
          <label className="label" htmlFor="auth-identifier">{ldap ? 'Directory username' : 'Email'}</label>
          <input
            id="auth-identifier"
            className="input py-2.5"
            type={ldap ? 'text' : 'email'}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete={ldap ? 'username' : 'email'}
            placeholder={ldap ? 'jsmith' : 'you@company.com'}
            maxLength={200}
            required
            autoFocus={mode === 'signIn'}
          />
        </div>
        <div>
          <label className="label" htmlFor="auth-password">Password</label>
          <div className="relative">
            <input
              id="auth-password"
              className="input py-2.5 pr-10"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              maxLength={200}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {mode === 'signUp' && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">At least 8 characters.</p>}
        </div>

        {error && <Alert message={error} />}

        <button type="submit" className="btn-primary w-full py-2.5" disabled={busy || !identifier || !password || (mode === 'signUp' && !name.trim())}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'signUp' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6 space-y-2 text-center text-sm text-slate-500 dark:text-slate-400">
        {mode === 'signIn' && !options.local && method === 'ldap' && (
          <p>
            Administrator?{' '}
            <button type="button" className="font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => setMethod('local')}>
              Sign in with a Workday password
            </button>
          </p>
        )}
        {mode === 'signIn' && !options.local && method === 'local' && options.ldap && (
          <p>
            <button type="button" className="font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => setMethod('ldap')}>
              Back to directory sign-in
            </button>
          </p>
        )}
        {mode === 'signIn' && options.signUp && (
          <p>
            New to Workday?{' '}
            <button type="button" className="font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => switchMode('signUp')}>
              Create an account
            </button>
          </p>
        )}
        {mode === 'signUp' && (
          <p>
            Already have an account?{' '}
            <button type="button" className="font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => switchMode('signIn')}>
              Sign in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

function MethodTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof KeyRound; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
        active
          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function Alert({ message }: { message: string }) {
  return (
    <div className="flex animate-fade-in items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

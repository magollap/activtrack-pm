import { useState } from 'react';
import { CheckCircle2, FlaskConical, ShieldCheck, User } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { backend } from '@/lib/backend';
import { errorMessage } from '@/lib/errors';
import type { AuthSettings, LdapTestResult } from '@/lib/backend/types';

export function LdapTestModal({ settings, onClose }: { settings: AuthSettings; onClose: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LdapTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await backend().testLdap(settings, username, password));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Test directory sign-in"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
          <button type="submit" form="ldap-test-form" className="btn-primary" disabled={busy || !username.trim() || !password}>
            <FlaskConical className="h-4 w-4" /> {busy ? 'Testing...' : 'Run test'}
          </button>
        </>
      }
    >
      <form id="ldap-test-form" onSubmit={run} className="space-y-4">
        <p className="text-sm text-slate-500">Uses the settings on screen, even unsaved ones. Nothing is saved and no account is created.</p>
        <div>
          <label className="label" htmlFor="ldap-test-user">Directory username</label>
          <input id="ldap-test-user" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="ldap-test-pass">Password</label>
          <input id="ldap-test-pass" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">{error}</p>}
        {result && (
          <div className="animate-fade-in space-y-2 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
            <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> Sign-in works</p>
            <p className="flex items-center gap-2"><User className="h-4 w-4" /> {result.name} ({result.email || 'no email found'})</p>
            <p className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Would sign in as {result.role === 'admin' ? 'an admin' : 'a basic member'}
            </p>
            <p className="text-xs opacity-80">
              {result.groups.length ? `Groups: ${result.groups.join(', ')}` : 'No groups were found for this person.'}
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
}

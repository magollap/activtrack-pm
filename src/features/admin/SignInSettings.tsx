import { useEffect, useState } from 'react';
import { FlaskConical, KeyRound, Network, Save, UserPlus } from 'lucide-react';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { LdapTestModal } from '@/features/admin/LdapTestModal';
import { useToast } from '@/hooks/useToast';
import { backend } from '@/lib/backend';
import { errorMessage } from '@/lib/errors';
import type { AuthSettings, LdapSettings } from '@/lib/backend/types';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
        checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

function MethodRow({ icon: Icon, title, description, checked, onChange }: {
  icon: typeof KeyRound;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 border-t border-slate-100 px-5 py-4 first:border-t-0 dark:border-slate-800">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

export function SignInSettings() {
  const toast = useToast();
  const [draft, setDraft] = useState<AuthSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [groupsText, setGroupsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let active = true;
    backend()
      .getAuthSettings()
      .then((settings) => {
        if (!active) return;
        setDraft(settings);
        setGroupsText(settings.ldap.adminGroups.join('\n'));
      })
      .catch((e: unknown) => active && setLoadError(errorMessage(e)));
    return () => {
      active = false;
    };
  }, []);

  if (loadError) return <ErrorState message={loadError} />;
  if (!draft) return <LoadingState />;

  const set = (patch: Partial<AuthSettings>) => setDraft({ ...draft, ...patch });
  const setLdap = (patch: Partial<LdapSettings>) => setDraft({ ...draft, ldap: { ...draft.ldap, ...patch } });
  const current = (): AuthSettings => ({
    ...draft,
    ldap: { ...draft.ldap, adminGroups: groupsText.split('\n').map((g) => g.trim()).filter(Boolean) },
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.localEnabled && !draft.ldapEnabled) {
      toast.error('Keep at least one sign-in method turned on.');
      return;
    }
    setSaving(true);
    try {
      await backend().saveAuthSettings(current());
      setLdap({ bindPassword: '', hasBindPassword: draft.ldap.hasBindPassword || Boolean(draft.ldap.bindPassword) });
      toast.success('Sign-in settings saved');
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  const field = (key: 'url' | 'bindDn' | 'baseDn' | 'userFilter' | 'nameAttribute' | 'emailAttribute', label: string, placeholder: string, hint?: string) => (
    <div>
      <label className="label" htmlFor={`ldap-${key}`}>{label}</label>
      <input id={`ldap-${key}`} className="input font-mono text-sm" value={draft.ldap[key]} onChange={(e) => setLdap({ [key]: e.target.value })} placeholder={placeholder} spellCheck={false} />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );

  return (
    <>
    <form onSubmit={save} className="space-y-6">
      <section className="card">
        <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="font-semibold">Sign-in methods</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Choose how people get into Workday. Admins can always use their Workday password, even when it is turned off for everyone else.</p>
        </header>
        <MethodRow icon={KeyRound} title="Workday passwords" description="People sign in with an email and a password stored on this server." checked={draft.localEnabled} onChange={(v) => set({ localEnabled: v })} />
        <MethodRow icon={UserPlus} title="Open sign-up" description="Anyone who can reach this server can create a Workday account. New accounts only see their own private space." checked={draft.signUpEnabled} onChange={(v) => set({ signUpEnabled: v })} />
        <MethodRow icon={Network} title="Company directory (LDAP)" description="People sign in with their directory username and password. Their account is created on first sign-in." checked={draft.ldapEnabled} onChange={(v) => set({ ldapEnabled: v })} />
      </section>

      <section className={`card transition-opacity ${draft.ldapEnabled ? '' : 'opacity-70'}`}>
        <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="font-semibold">Directory connection</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Works with Active Directory, OpenLDAP and most other directory servers your network can reach.</p>
        </header>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">{field('url', 'Server address', 'ldaps://ldap.example.com:636', 'Starts with ldap:// or ldaps://')}</div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={draft.ldap.startTls} onChange={(e) => setLdap({ startTls: e.target.checked })} />
            Upgrade to a secure connection (StartTLS)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={draft.ldap.allowSelfSigned} onChange={(e) => setLdap({ allowSelfSigned: e.target.checked })} />
            Accept self-signed certificates
          </label>
          {field('bindDn', 'Service account', 'cn=workday,ou=services,dc=example,dc=com', 'Used to look people up. Leave empty for anonymous lookups.')}
          <div>
            <label className="label" htmlFor="ldap-bindPassword">Service account password</label>
            <input
              id="ldap-bindPassword"
              type="password"
              className="input"
              autoComplete="new-password"
              value={draft.ldap.bindPassword}
              onChange={(e) => setLdap({ bindPassword: e.target.value })}
              placeholder={draft.ldap.hasBindPassword ? 'Saved - leave empty to keep it' : ''}
            />
          </div>
          <div className="sm:col-span-2">{field('baseDn', 'Search base', 'dc=example,dc=com')}</div>
          <div className="sm:col-span-2">{field('userFilter', 'User filter', '(uid={{username}})', 'Must contain {{username}}, which is replaced by what the person types.')}</div>
          {field('nameAttribute', 'Name attribute', 'displayName')}
          {field('emailAttribute', 'Email attribute', 'mail')}
          <div className="sm:col-span-2">
            <label className="label" htmlFor="ldap-groups">Admin groups</label>
            <textarea
              id="ldap-groups"
              className="input min-h-[88px] font-mono text-sm"
              value={groupsText}
              onChange={(e) => setGroupsText(e.target.value)}
              placeholder={'workday-admins\ncn=it-admins,ou=groups,dc=example,dc=com'}
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-slate-500">
              One group per line, by name or full path. Members become Workday admins and everyone else gets a basic account; this is checked at every sign-in. Leave empty to manage roles in Workday instead.
            </p>
          </div>
        </div>
        <footer className="flex justify-end border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <button type="button" className="btn-secondary" onClick={() => setTesting(true)} disabled={!draft.ldap.url.trim()}>
            <FlaskConical className="h-4 w-4" /> Test with a user
          </button>
        </footer>
      </section>

      <div className="sticky bottom-4 flex justify-end">
        <button className="btn-primary shadow-lg" disabled={saving}><Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save settings'}</button>
      </div>

    </form>
    {testing && <LdapTestModal settings={current()} onClose={() => setTesting(false)} />}
    </>
  );
}

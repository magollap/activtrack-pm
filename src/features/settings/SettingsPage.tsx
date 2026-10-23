import { useSearchParams } from 'react-router-dom';
import { Database, KeyRound, Smartphone, UserCircle, Users } from 'lucide-react';
import { ProfileSettings } from '@/features/settings/ProfileSettings';
import { DataSettings } from '@/features/settings/DataSettings';
import { AppSettings } from '@/features/settings/AppSettings';
import { UsersSettings } from '@/features/admin/UsersSettings';
import { SignInSettings } from '@/features/admin/SignInSettings';
import { useAuth, useCurrentUser } from '@/features/auth/AuthProvider';

const TABS = [
  { id: 'profile', label: 'Profile', icon: UserCircle, admin: false, localOnly: false },
  { id: 'users', label: 'Users', icon: Users, admin: true, localOnly: false },
  { id: 'sign-in', label: 'Sign-in', icon: KeyRound, admin: true, localOnly: true },
  { id: 'data', label: 'Data', icon: Database, admin: false, localOnly: false },
  { id: 'app', label: 'App', icon: Smartphone, admin: false, localOnly: false },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const me = useCurrentUser();
  const { kind } = useAuth();
  const tabs = TABS.filter((t) => (!t.admin || me.role === 'admin') && (!t.localOnly || kind === 'local'));
  const tab: TabId = tabs.find((t) => t.id === params.get('tab'))?.id ?? 'profile';

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
      <div className="-mx-4 mt-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 dark:border-slate-800 sm:mx-0 sm:px-0" role="tablist">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setParams({ tab: id }, { replace: true })}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              tab === id
                ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      <div className="mt-6 animate-fade-in" key={tab}>
        {tab === 'profile' && <ProfileSettings />}
        {tab === 'users' && <UsersSettings />}
        {tab === 'sign-in' && <SignInSettings />}
        {tab === 'data' && <DataSettings />}
        {tab === 'app' && <AppSettings />}
      </div>
    </div>
  );
}

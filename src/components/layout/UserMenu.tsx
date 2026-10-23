import { Link } from 'react-router-dom';
import { LogOut, Settings, ShieldCheck } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Popover } from '@/components/Popover';
import { useAuth, useCurrentUser } from '@/features/auth/AuthProvider';

const itemClass =
  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700';

export function UserMenu() {
  const me = useCurrentUser();
  const { signOut } = useAuth();

  return (
    <Popover
      align="right"
      width="w-64"
      trigger={({ open, toggle }) => (
        <button
          onClick={toggle}
          aria-expanded={open}
          aria-label="Account menu"
          className="rounded-full ring-offset-2 transition-shadow hover:ring-2 hover:ring-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:ring-offset-slate-900 dark:hover:ring-brand-800"
        >
          <Avatar member={me} size="md" />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-3 py-2.5">
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
              {me.name}
              {me.role === 'admin' && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-label="Admin" />}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{me.email}</p>
          </div>
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-700" />
          <Link to="/settings?tab=profile" className={itemClass} onClick={close}>
            <Settings className="h-4 w-4" /> Profile & settings
          </Link>
          <button className={`${itemClass} text-red-600 dark:text-red-400`} onClick={() => { close(); void signOut(); }}>
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </>
      )}
    </Popover>
  );
}

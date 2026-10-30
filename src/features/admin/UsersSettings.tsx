import { useState } from 'react';
import { FolderKey, KeyRound, Network, ShieldCheck, UserCheck, UserPlus, UserX } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { AddUserModal } from '@/features/admin/AddUserModal';
import { UserProjectsModal } from '@/features/admin/UserProjectsModal';
import { useCurrentUser } from '@/features/auth/AuthProvider';
import { useQuery } from '@/hooks/useQuery';
import { useToast } from '@/hooks/useToast';
import { listMembers } from '@/lib/db/members';
import { ROLE_META } from '@/lib/db/access';
import { adminUpdateUser } from '@/lib/db/users';
import { ROLES, type Member, type Role } from '@/lib/db/types';

export function UsersSettings() {
  const toast = useToast();
  const me = useCurrentUser();
  const { data: users, loading, error } = useQuery(listMembers, 'admin:users');
  const [projectsFor, setProjectsFor] = useState<Member | null>(null);
  const [disabling, setDisabling] = useState<Member | null>(null);
  const [adding, setAdding] = useState(false);

  if (loading && !users) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!users) return null;

  const update = async (user: Member, role: Role, disabled: boolean) => {
    try {
      await adminUpdateUser(user.id, role, disabled);
      toast.success(disabled !== user.disabled ? (disabled ? 'Account disabled' : 'Account enabled') : 'Role updated');
    } catch (e) {
      toast.error(e);
    }
  };

  const active = users.filter((u) => !u.disabled).length;

  return (
    <section className="card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div>
          <h3 className="font-semibold">Users</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {users.length} account{users.length === 1 ? '' : 's'}, {active} active. Add people here, or let them sign up and set their role afterwards.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          <UserPlus className="h-4 w-4" /> Add user
        </button>
      </header>
      <ul>
        {users.map((user) => {
          const isMe = user.id === me.id;
          return (
            <li key={user.id} className={`flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-3 first:border-t-0 dark:border-slate-800 ${user.disabled ? 'opacity-60' : ''}`}>
              <Avatar member={user} size="md" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium">
                  {user.name}
                  {isMe && <span className="rounded-full bg-brand-50 px-1.5 text-[10px] font-semibold uppercase text-brand-700 dark:bg-brand-950 dark:text-brand-300">You</span>}
                  {user.disabled && <span className="rounded-full bg-red-50 px-1.5 text-[10px] font-semibold uppercase text-red-700 dark:bg-red-950 dark:text-red-300">Disabled</span>}
                </p>
                <p className="flex items-center gap-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  {user.authSource === 'ldap' ? <Network className="h-3 w-3 shrink-0" /> : <KeyRound className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{user.email}</span>
                  <span className="hidden sm:inline">· {user.authSource === 'ldap' ? 'Company directory' : 'ActivTrack password'}</span>
                </p>
              </div>
              <div className="flex w-full items-center gap-1 sm:w-auto">
                <select
                  className="input w-auto py-1.5 text-sm"
                  value={user.role}
                  disabled={isMe}
                  onChange={(e) => void update(user, e.target.value as Role, user.disabled)}
                  aria-label={`Role for ${user.name}`}
                  title={isMe ? 'You cannot change your own role' : ROLE_META[user.role].description}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_META[r].label}</option>
                  ))}
                </select>
                {user.role === 'governor' ? (
                  <span className="icon-btn cursor-default text-brand-600" title="Governors have full control of every shared project">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                ) : (
                  <button className="icon-btn" onClick={() => setProjectsFor(user)} aria-label={`Project access for ${user.name}`} title="Project access">
                    <FolderKey className="h-4 w-4" />
                  </button>
                )}
                {!isMe && (
                  user.disabled ? (
                    <button className="icon-btn hover:text-emerald-600" onClick={() => void update(user, user.role, false)} aria-label={`Enable ${user.name}`} title="Enable account">
                      <UserCheck className="h-4 w-4" />
                    </button>
                  ) : (
                    <button className="icon-btn hover:text-red-600" onClick={() => setDisabling(user)} aria-label={`Disable ${user.name}`} title="Disable account">
                      <UserX className="h-4 w-4" />
                    </button>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800">
        Directory users get their role from the directory groups you list under Sign-in, so a role change here is replaced at their next sign-in.
      </p>
      {adding && <AddUserModal onClose={() => setAdding(false)} />}
      {projectsFor && <UserProjectsModal user={projectsFor} onClose={() => setProjectsFor(null)} />}
      {disabling && (
        <ConfirmDialog
          title={`Disable ${disabling.name}?`}
          message="They lose access right away and cannot sign in again until you enable the account. Their tasks and comments stay in place."
          confirmLabel="Disable account"
          destructive
          onConfirm={() => update(disabling, disabling.role, true)}
          onClose={() => setDisabling(null)}
        />
      )}
    </section>
  );
}

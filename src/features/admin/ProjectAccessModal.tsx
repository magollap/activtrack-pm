import { useMemo, useState } from 'react';
import { ShieldCheck, UserPlus, X } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Modal } from '@/components/Modal';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useQuery } from '@/hooks/useQuery';
import { useToast } from '@/hooks/useToast';
import { ACCESS_META } from '@/lib/db/access';
import { listMembers } from '@/lib/db/members';
import { grantAccess, listProjectMembers, revokeAccess } from '@/lib/db/projectMembers';
import { ACCESS_LEVELS, type AccessLevel, type Project } from '@/lib/db/types';

async function loadPeople(projectId: string) {
  const [users, memberships] = await Promise.all([listMembers(), listProjectMembers(projectId)]);
  return { users, memberships };
}

export function ProjectAccessModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const toast = useToast();
  const { data, loading, error } = useQuery(() => loadPeople(project.id), `people:${project.id}`);
  const [newUserId, setNewUserId] = useState('');
  const [newAccess, setNewAccess] = useState<AccessLevel>('write');
  const [busy, setBusy] = useState(false);

  const { admins, rows, candidates } = useMemo(() => {
    const users = data?.users ?? [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const memberIds = new Set(data?.memberships.map((m) => m.userId));
    return {
      admins: users.filter((u) => u.role === 'admin' && !u.disabled),
      rows: (data?.memberships ?? [])
        .map((m) => ({ membership: m, user: byId.get(m.userId) }))
        .filter((r) => r.user && r.user.role !== 'admin')
        .sort((a, b) => (a.user?.name ?? '').localeCompare(b.user?.name ?? '')),
      candidates: users.filter((u) => u.role !== 'admin' && !u.disabled && !memberIds.has(u.id)),
    };
  }, [data]);

  const run = async (action: () => Promise<void>, message: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(message);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId) return;
    void run(async () => {
      await grantAccess(project.id, newUserId, newAccess);
      setNewUserId('');
    }, 'Person added to project');
  };

  return (
    <Modal title={`People in ${project.name}`} onClose={onClose} size="lg">
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="space-y-5">
          <form onSubmit={add} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="mb-2 text-sm font-medium">Add someone</p>
            {candidates.length === 0 ? (
              <p className="text-xs text-slate-500">Everyone who has signed up already has access. New people appear here after they create an account.</p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <select className="input sm:flex-1" value={newUserId} onChange={(e) => setNewUserId(e.target.value)} aria-label="Person">
                  <option value="">Choose a person...</option>
                  {candidates.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
                <select className="input sm:w-56" value={newAccess} onChange={(e) => setNewAccess(e.target.value as AccessLevel)} aria-label="Access level">
                  {ACCESS_LEVELS.map((a) => <option key={a} value={a}>{ACCESS_META[a].label}</option>)}
                </select>
                <button className="btn-primary" disabled={!newUserId || busy}><UserPlus className="h-4 w-4" /> Add</button>
              </div>
            )}
          </form>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Members</p>
            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700">
                Nobody has been added yet. Only admins can see this project.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map(({ membership, user }) => (
                  <li key={membership.id} className="flex items-center gap-3 py-2.5">
                    <Avatar member={user} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{user?.name}</p>
                      <p className="truncate text-xs text-slate-500">{user?.disabled ? 'Account disabled' : user?.email}</p>
                    </div>
                    <select
                      className="input w-auto py-1.5 text-xs sm:text-sm"
                      value={membership.access}
                      disabled={busy}
                      onChange={(e) => void run(() => grantAccess(project.id, membership.userId, e.target.value as AccessLevel), 'Access updated')}
                      aria-label={`Access for ${user?.name}`}
                    >
                      {ACCESS_LEVELS.map((a) => <option key={a} value={a}>{ACCESS_META[a].label}</option>)}
                    </select>
                    <button
                      className="icon-btn hover:text-red-600"
                      disabled={busy}
                      onClick={() => void run(() => revokeAccess(membership.id), 'Access removed')}
                      aria-label={`Remove ${user?.name}`}
                      title="Remove from project"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {admins.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Admins (always full control)</p>
              <div className="flex flex-wrap gap-2">
                {admins.map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-1 pr-2.5 text-xs dark:bg-slate-800">
                    <Avatar member={a} size="xs" /> {a.name} <ShieldCheck className="h-3 w-3 text-brand-600" />
                  </span>
                ))}
              </div>
            </div>
          )}

          <dl className="grid gap-2 rounded-xl border border-slate-100 p-3 text-xs dark:border-slate-800 sm:grid-cols-3">
            {ACCESS_LEVELS.map((a) => (
              <div key={a}>
                <dt className="font-medium text-slate-700 dark:text-slate-200">{ACCESS_META[a].label}</dt>
                <dd className="text-slate-500">{ACCESS_META[a].description}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Modal>
  );
}

import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useQuery } from '@/hooks/useQuery';
import { useToast } from '@/hooks/useToast';
import { ACCESS_META } from '@/lib/db/access';
import { listProjects } from '@/lib/db/projects';
import { grantAccess, listMyMemberships, revokeAccess } from '@/lib/db/projectMembers';
import { ACCESS_LEVELS, type AccessLevel, type Member } from '@/lib/db/types';

async function loadAccess(userId: string) {
  const [projects, memberships] = await Promise.all([listProjects(), listMyMemberships(userId)]);
  return { projects: projects.filter((p) => !p.isPersonal), memberships };
}

export function UserProjectsModal({ user, onClose }: { user: Member; onClose: () => void }) {
  const toast = useToast();
  const { data, loading, error } = useQuery(() => loadAccess(user.id), `user-access:${user.id}`);
  const [busyId, setBusyId] = useState<string | null>(null);

  const change = async (projectId: string, value: AccessLevel | '') => {
    const existing = data?.memberships.find((m) => m.projectId === projectId);
    setBusyId(projectId);
    try {
      if (value) await grantAccess(projectId, user.id, value);
      else if (existing) await revokeAccess(existing.id);
      toast.success(value ? 'Access updated' : 'Access removed');
    } catch (e) {
      toast.error(e);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal title={`Project access for ${user.name}`} onClose={onClose} size="lg">
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : !data || data.projects.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">There are no shared projects yet. Create one from the sidebar first.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">{user.name} always has their own private space. Choose which shared projects they can open.</p>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.projects.map((project) => {
              const access = data.memberships.find((m) => m.projectId === project.id)?.access ?? '';
              return (
                <li key={project.id} className="flex items-center gap-3 py-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {project.name}
                    {project.archivedAt && <span className="ml-2 text-xs font-normal text-slate-400">Archived</span>}
                  </span>
                  <select
                    className={`input w-auto py-1.5 text-sm ${access ? '' : 'text-slate-400'}`}
                    value={access}
                    disabled={busyId === project.id}
                    onChange={(e) => void change(project.id, e.target.value as AccessLevel | '')}
                    aria-label={`Access to ${project.name}`}
                  >
                    <option value="">No access</option>
                    {ACCESS_LEVELS.map((a) => <option key={a} value={a}>{ACCESS_META[a].label}</option>)}
                  </select>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}

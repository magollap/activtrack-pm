import { ACCESS_LEVELS, type AccessLevel, type Member, type Project, type ProjectAccess, type ProjectMember, type Role, type Task } from '@/lib/db/types';

/** Mirrors the server's rules so screens only offer what the person is allowed to do. */
export function projectAccess(project: Project, me: Member, memberships: ProjectMember[]): ProjectAccess | null {
  if (me.disabled) return null;
  if (project.isPersonal) return project.ownerId === me.id ? 'manage' : null;
  if (me.role === 'governor') return 'manage';
  if (me.role === 'delegate' && project.createdBy === me.id) return 'lead';
  const granted = memberships.find((m) => m.projectId === project.id && m.userId === me.id)?.access ?? null;
  return granted && me.role === 'reporter' ? 'read' : granted;
}

export const canWrite = (access: ProjectAccess | null): boolean =>
  access === 'write' || access === 'write_delete' || access === 'lead' || access === 'manage';

export const canManage = (access: ProjectAccess | null): boolean => access === 'lead' || access === 'manage';

export const isGovernor = (me: Member): boolean => me.role === 'governor' && !me.disabled;

export const canCreateProjects = (me: Member): boolean => (me.role === 'governor' || me.role === 'delegate') && !me.disabled;

/** Reporters are always read only, so there is nothing else to grant them. */
export const grantableLevels = (role: Role): readonly AccessLevel[] => (role === 'reporter' ? ['read'] : ACCESS_LEVELS);

export function canDeleteTask(access: ProjectAccess | null, task: Pick<Task, 'createdBy'>, me: Member): boolean {
  if (canManage(access)) return true;
  return access === 'write_delete' && task.createdBy === me.id;
}

export const ACCESS_META: Record<ProjectAccess, { label: string; description: string }> = {
  read: { label: 'Read only', description: 'Can view tasks and comments, but cannot change anything.' },
  write: { label: 'Read & write', description: 'Can add and edit tasks, checklists and comments.' },
  write_delete: {
    label: 'Read, write & delete own',
    description: 'Can also delete tasks they created themselves.',
  },
  lead: { label: 'Project lead', description: 'Runs this project: every task, the workflow and settings. Only a governor can delete it.' },
  manage: { label: 'Full control', description: 'Can change the project, its workflow and every task.' },
};

export const ROLE_META: Record<Role, { label: string; description: string }> = {
  governor: { label: 'Governor', description: 'Super admin. Sees every project, creates and deletes projects, manages people and access.' },
  delegate: { label: 'Delegate', description: 'Project manager. Creates projects and runs their tasks. Sees other projects only when a governor gives access.' },
  reporter: { label: 'Reporter', description: 'Read only. Views the projects a governor allocates for reporting.' },
};

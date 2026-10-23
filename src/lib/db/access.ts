import type { Member, Project, ProjectAccess, ProjectMember, Task } from '@/lib/db/types';

/** Mirrors the server's rules so screens only offer what the person is allowed to do. */
export function projectAccess(project: Project, me: Member, memberships: ProjectMember[]): ProjectAccess | null {
  if (me.disabled) return null;
  if (project.isPersonal) return project.ownerId === me.id ? 'manage' : null;
  if (me.role === 'admin') return 'manage';
  return memberships.find((m) => m.projectId === project.id && m.userId === me.id)?.access ?? null;
}

export const canWrite = (access: ProjectAccess | null): boolean =>
  access === 'write' || access === 'write_delete' || access === 'manage';

export const canManage = (access: ProjectAccess | null): boolean => access === 'manage';

export function canDeleteTask(access: ProjectAccess | null, task: Pick<Task, 'createdBy'>, me: Member): boolean {
  if (access === 'manage') return true;
  return access === 'write_delete' && task.createdBy === me.id;
}

export const ACCESS_META: Record<ProjectAccess, { label: string; description: string }> = {
  read: { label: 'Read only', description: 'Can view tasks and comments, but cannot change anything.' },
  write: { label: 'Read & write', description: 'Can add and edit tasks, checklists and comments.' },
  write_delete: {
    label: 'Read, write & delete own',
    description: 'Can also delete tasks they created themselves.',
  },
  manage: { label: 'Full control', description: 'Can change the project, its workflow and every task.' },
};

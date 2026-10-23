import { getProject } from '@/lib/db/projects';
import { listStatuses } from '@/lib/db/statuses';
import { listTasks } from '@/lib/db/tasks';
import { listMembers } from '@/lib/db/members';
import { listChecklistItems } from '@/lib/db/checklist';
import { listProjectMembers } from '@/lib/db/projectMembers';
import { projectAccess } from '@/lib/db/access';
import { useQuery } from '@/hooks/useQuery';
import type { Member, Project, ProjectAccess, Status, Task } from '@/lib/db/types';

export interface ChecklistCount {
  done: number;
  total: number;
}

export interface ProjectData {
  project: Project;
  statuses: Status[];
  tasks: Task[];
  /** People who can open this project, so they can be assigned tasks. */
  members: Member[];
  checklist: Map<string, ChecklistCount>;
  access: ProjectAccess | null;
}

async function loadProjectData(projectId: string, me: Member): Promise<ProjectData | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  const [statuses, tasks, profiles, memberships] = await Promise.all([
    listStatuses(projectId),
    listTasks(projectId),
    listMembers(),
    listProjectMembers(projectId),
  ]);
  const items = tasks.length ? await listChecklistItems(tasks.map((t) => t.id)) : [];
  const checklist = new Map<string, ChecklistCount>();
  for (const item of items) {
    const count = checklist.get(item.taskId) ?? { done: 0, total: 0 };
    count.total += 1;
    if (item.done) count.done += 1;
    checklist.set(item.taskId, count);
  }
  const memberIds = new Set(memberships.map((m) => m.userId));
  const members = profiles.filter((p) =>
    project.isPersonal ? p.id === project.ownerId : !p.disabled && (p.role === 'governor' || p.id === project.createdBy || memberIds.has(p.id)),
  );
  return { project, statuses, tasks, members, checklist, access: projectAccess(project, me, memberships) };
}

export function useProjectData(projectId: string, me: Member) {
  return useQuery(() => loadProjectData(projectId, me), `project:${projectId}:${me.id}:${me.role}`);
}

import { getProject } from '@/lib/db/projects';
import { listStatuses } from '@/lib/db/statuses';
import { listTasks } from '@/lib/db/tasks';
import { listMembers } from '@/lib/db/members';
import { listChecklistItems } from '@/lib/db/checklist';
import { listProjectMembers } from '@/lib/db/projectMembers';
import { listFields } from '@/lib/db/fields';
import { entryMinutes, listTimeEntries } from '@/lib/db/time';
import { listAttachments } from '@/lib/db/attachments';
import { listStatusUpdates } from '@/lib/db/statusUpdates';
import { projectAccess } from '@/lib/db/access';
import { useQuery } from '@/hooks/useQuery';
import type { CustomField, Member, Project, ProjectAccess, Status, StatusUpdate, Task } from '@/lib/db/types';

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
  /** The project's custom fields, in display order. */
  fields: CustomField[];
  /** Minutes logged per card (running timers count up to now). */
  timeByTask: Map<string, number>;
  attachmentsByTask: Map<string, number>;
  latestUpdate: StatusUpdate | null;
}

export async function loadProjectData(projectId: string, me: Member): Promise<ProjectData | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  const [statuses, tasks, profiles, memberships, fields, updates] = await Promise.all([
    listStatuses(projectId),
    listTasks(projectId),
    listMembers(),
    listProjectMembers(projectId),
    listFields(projectId),
    listStatusUpdates(projectId),
  ]);
  const ids = tasks.map((t) => t.id);
  const [items, entries, files] = ids.length ? await Promise.all([listChecklistItems(ids), listTimeEntries(ids), listAttachments(ids)]) : [[], [], []];
  const timeByTask = new Map<string, number>();
  for (const e of entries) timeByTask.set(e.taskId, (timeByTask.get(e.taskId) ?? 0) + entryMinutes(e));
  const attachmentsByTask = new Map<string, number>();
  for (const a of files) attachmentsByTask.set(a.taskId, (attachmentsByTask.get(a.taskId) ?? 0) + 1);
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
  return { project, statuses, tasks, members, checklist, fields, timeByTask, attachmentsByTask, latestUpdate: updates[0] ?? null, access: projectAccess(project, me, memberships) };
}

export function useProjectData(projectId: string, me: Member) {
  return useQuery(() => loadProjectData(projectId, me), `project:${projectId}:${me.id}:${me.role}`);
}

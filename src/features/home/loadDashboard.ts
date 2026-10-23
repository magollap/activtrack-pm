import { isThisWeek } from 'date-fns';
import { listProjects } from '@/lib/db/projects';
import { listStatuses } from '@/lib/db/statuses';
import { listTasks } from '@/lib/db/tasks';
import { listMembers } from '@/lib/db/members';
import { dueTone } from '@/lib/dates';
import type { Member, Project, Status, Task } from '@/lib/db/types';

export interface AttentionItem {
  task: Task;
  project: Project;
  status: Status | undefined;
  tone: 'overdue' | 'today';
}

export interface DashboardData {
  openCount: number;
  dueTodayCount: number;
  overdueCount: number;
  completedThisWeek: number;
  attention: AttentionItem[];
  workload: { member: Member | null; open: number }[];
}

export async function loadDashboard(): Promise<DashboardData> {
  const [projects, statuses, allTasks, members] = await Promise.all([listProjects(), listStatuses(), listTasks(), listMembers()]);
  const activeProjects = new Map(projects.filter((p) => !p.archivedAt).map((p) => [p.id, p]));
  const statusMap = new Map(statuses.map((s) => [s.id, s]));
  const tasks = allTasks.filter((t) => activeProjects.has(t.projectId));
  const open = tasks.filter((t) => !statusMap.get(t.statusId)?.isDone);

  const attention: AttentionItem[] = [];
  for (const task of open) {
    const tone = dueTone(task.dueDate, false);
    if (tone === 'normal') continue;
    attention.push({ task, project: activeProjects.get(task.projectId)!, status: statusMap.get(task.statusId), tone });
  }
  attention.sort((a, b) => (a.task.dueDate ?? '').localeCompare(b.task.dueDate ?? ''));

  const openByMember = new Map<string | null, number>();
  for (const task of open) openByMember.set(task.assigneeId, (openByMember.get(task.assigneeId) ?? 0) + 1);
  const knownIds = new Set(members.map((m) => m.id));
  const unassigned = open.filter((t) => !t.assigneeId || !knownIds.has(t.assigneeId)).length;
  const workload = [
    ...members
      .map((member) => ({ member, open: openByMember.get(member.id) ?? 0 }))
      .filter((w) => w.open > 0)
      .sort((a, b) => b.open - a.open),
    ...(unassigned ? [{ member: null, open: unassigned }] : []),
  ];

  return {
    openCount: open.length,
    dueTodayCount: attention.filter((a) => a.tone === 'today').length,
    overdueCount: attention.filter((a) => a.tone === 'overdue').length,
    completedThisWeek: tasks.filter((t) => t.completedAt && isThisWeek(new Date(t.completedAt), { weekStartsOn: 1 })).length,
    attention,
    workload,
  };
}

import { table } from '@/lib/db/tables';
import { PRIORITY_META } from '@/lib/priority';

function cell(value: string): string {
  // Prefix formula-like values so spreadsheets do not execute them.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function exportTasksCsv(): Promise<string> {
  const [projectRows, statusRows, memberRows, tasks] = await Promise.all([
    table('projects').list(),
    table('statuses').list(),
    table('profiles').list(),
    table('tasks').list(),
  ]);
  const projects = new Map(projectRows.map((p) => [p.id, p.name]));
  const statuses = new Map(statusRows.map((s) => [s.id, s.name]));
  const members = new Map(memberRows.map((m) => [m.id, m.name]));
  const header = ['Project', 'Title', 'Status', 'Priority', 'Assignee', 'Start date', 'Due date', 'Completed at', 'Created at', 'Description'];
  const rows = tasks.map((t) => [
    projects.get(t.projectId) ?? '',
    t.title,
    statuses.get(t.statusId) ?? '',
    PRIORITY_META[t.priority]?.label ?? t.priority,
    t.assigneeId ? members.get(t.assigneeId) ?? '' : '',
    t.startDate ?? '',
    t.dueDate ?? '',
    t.completedAt ?? '',
    t.createdAt,
    t.description,
  ]);
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

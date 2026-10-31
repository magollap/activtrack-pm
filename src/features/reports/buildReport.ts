import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { listFields } from '@/lib/db/fields';
import { listMembers } from '@/lib/db/members';
import { listProjects } from '@/lib/db/projects';
import { listStatuses } from '@/lib/db/statuses';
import { listTasks } from '@/lib/db/tasks';
import { entryMinutes, listTimeEntries } from '@/lib/db/time';
import { parseDay } from '@/lib/dates';
import { PRIORITY_META } from '@/lib/priority';
import { PRIORITIES, type CustomField, type Member, type Project, type Status, type Task, type TimeEntry } from '@/lib/db/types';

export type Period = 'daily' | 'weekly' | 'monthly';

export interface ReportSource {
  projects: Project[];
  statuses: Status[];
  tasks: Task[];
  members: Member[];
  fields: CustomField[];
  timeEntries: TimeEntry[];
}

/** Everything the reports page can see: active projects only. */
export async function loadReportSource(): Promise<ReportSource> {
  const [projects, statuses, tasks, members, fields, timeEntries] = await Promise.all([listProjects(), listStatuses(), listTasks(), listMembers(), listFields(), listTimeEntries()]);
  const active = projects.filter((p) => !p.archivedAt);
  const ids = new Set(active.map((p) => p.id));
  return {
    projects: active,
    statuses: statuses.filter((s) => ids.has(s.projectId)),
    tasks: tasks.filter((t) => ids.has(t.projectId)),
    members,
    fields: fields.filter((f) => ids.has(f.projectId)),
    timeEntries,
  };
}

export interface Range {
  start: Date;
  end: Date;
  label: string;
}

const WEEK = { weekStartsOn: 1 as const };

export function periodRange(period: Period, anchor: Date): Range {
  if (period === 'daily') return { start: startOfDay(anchor), end: endOfDay(anchor), label: format(anchor, 'EEEE, MMMM d, yyyy') };
  if (period === 'weekly') {
    const start = startOfWeek(anchor, WEEK);
    const end = endOfWeek(anchor, WEEK);
    return { start, end, label: `Week of ${format(start, 'MMM d')} – ${format(end, start.getMonth() === end.getMonth() ? 'd, yyyy' : 'MMM d, yyyy')}` };
  }
  return { start: startOfMonth(anchor), end: endOfMonth(anchor), label: format(anchor, 'MMMM yyyy') };
}

export function shiftAnchor(period: Period, anchor: Date, steps: number): Date {
  if (period === 'daily') return addDays(anchor, steps);
  if (period === 'weekly') return addWeeks(anchor, steps);
  return addMonths(anchor, steps);
}

/** The buckets in the trend chart: the last 14 days, 12 weeks or 6 months up to and including the period. */
function trendRanges(period: Period, anchor: Date): Range[] {
  const count = period === 'daily' ? 14 : period === 'weekly' ? 12 : 6;
  return Array.from({ length: count }, (_, i) => {
    const back = count - 1 - i;
    const at = period === 'daily' ? subDays(anchor, back) : period === 'weekly' ? subWeeks(anchor, back) : subMonths(anchor, back);
    const r = periodRange(period, at);
    return { ...r, label: period === 'daily' ? format(r.start, 'MMM d') : period === 'weekly' ? format(r.start, 'MMM d') : format(r.start, 'MMM yyyy') };
  });
}

export interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface Row {
  task: Task;
  project: Project | undefined;
  status: Status | undefined;
  assignee: Member | undefined;
}

export interface Report {
  range: Range;
  created: number;
  completed: number;
  /** Open at the end of the period. */
  openAtEnd: number;
  overdueAtEnd: number;
  completionRate: number | null;
  avgCycleDays: number | null;
  total: number;
  trend: { label: string; created: number; completed: number }[];
  byStatus: Slice[];
  byPriority: Slice[];
  byAssignee: Slice[];
  byProject: Slice[];
  /** Breakdown by the first dropdown custom field (single-project reports only). */
  byField: { field: CustomField; slices: Slice[] } | null;
  /** Minutes logged during the period, and who logged them. */
  minutesLogged: number;
  timeByPerson: Slice[];
  completedRows: Row[];
  createdRows: Row[];
  overdueRows: Row[];
}

const PRIORITY_COLORS: Record<string, string> = { low: '#94a3b8', medium: '#2550e8', high: '#c9a227', urgent: '#e11d48' };
const inRange = (iso: string | null | undefined, r: Range) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= r.start.getTime() && t <= r.end.getTime();
};

/** A card was open at a moment if it existed then and was not yet completed. */
const openAt = (task: Task, at: Date) =>
  new Date(task.createdAt).getTime() <= at.getTime() && (!task.completedAt || new Date(task.completedAt).getTime() > at.getTime());

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1);
  return map;
}

export function buildReport(source: ReportSource, period: Period, anchor: Date, projectId: string | null): Report {
  const range = periodRange(period, anchor);
  const tasks = projectId ? source.tasks.filter((t) => t.projectId === projectId) : source.tasks;
  const statusMap = new Map(source.statuses.map((s) => [s.id, s]));
  const projectMap = new Map(source.projects.map((p) => [p.id, p]));
  const memberMap = new Map(source.members.map((m) => [m.id, m]));
  const row = (task: Task): Row => ({ task, project: projectMap.get(task.projectId), status: statusMap.get(task.statusId), assignee: task.assigneeId ? memberMap.get(task.assigneeId) : undefined });

  const createdTasks = tasks.filter((t) => inRange(t.createdAt, range));
  const completedTasks = tasks.filter((t) => inRange(t.completedAt, range));
  // Snapshot at the end of the period, or now if the period is still running.
  const at = new Date(Math.min(range.end.getTime(), Date.now()));
  const open = tasks.filter((t) => openAt(t, at));
  const overdue = open.filter((t) => {
    const due = t.dueDate ? parseDay(t.dueDate) : null;
    return due !== null && differenceInCalendarDays(due, at) < 0;
  });
  const workload = tasks.filter((t) => openAt(t, range.start)).length + createdTasks.length;
  const cycle = completedTasks.map((t) => Math.max(0, (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()) / 86_400_000));

  // Status breakdown: current status of everything in scope, per status name (so "Done" across projects adds up).
  const statusByName = new Map<string, Slice>();
  for (const t of tasks) {
    const s = statusMap.get(t.statusId);
    if (!s) continue;
    const slice = statusByName.get(s.name.toLowerCase()) ?? { key: s.name.toLowerCase(), label: s.name, value: 0, color: s.color };
    slice.value += 1;
    statusByName.set(slice.key, slice);
  }

  const priorityCounts = countBy(open, (t) => t.priority);
  const assigneeCounts = countBy(open, (t) => t.assigneeId ?? '');
  const projectCounts = countBy(open, (t) => t.projectId);

  let byField: Report['byField'] = null;
  if (projectId) {
    const field = source.fields.filter((f) => f.projectId === projectId && f.type === 'select').sort((a, b) => a.order - b.order)[0];
    if (field) {
      const counts = countBy(tasks, (t) => String(t.customValues?.[field.id] ?? ''));
      const slices = field.options.map((o) => ({ key: o.id, label: o.label, value: counts.get(o.id) ?? 0, color: o.color })).filter((s) => s.value > 0);
      const none = counts.get('') ?? 0;
      if (none) slices.push({ key: '', label: 'Not set', value: none, color: '#94a3b8' });
      byField = { field, slices };
    }
  }

  const taskIds = new Set(tasks.map((t) => t.id));
  const periodEntries = source.timeEntries.filter((e) => taskIds.has(e.taskId) && inRange(e.startedAt, range));
  const minutesByPerson = new Map<string, number>();
  for (const e of periodEntries) minutesByPerson.set(e.userId ?? '', (minutesByPerson.get(e.userId ?? '') ?? 0) + entryMinutes(e));

  return {
    range,
    minutesLogged: periodEntries.reduce((sum, e) => sum + entryMinutes(e), 0),
    timeByPerson: [...minutesByPerson.entries()]
      .map(([id, value]) => ({ key: id || 'none', label: memberMap.get(id)?.name ?? 'Former member', value, color: memberMap.get(id)?.color ?? '#94a3b8' }))
      .sort((a, b) => b.value - a.value),
    created: createdTasks.length,
    completed: completedTasks.length,
    openAtEnd: open.length,
    overdueAtEnd: overdue.length,
    // Share of the period's workload (open at the start, plus anything new) that got finished.
    completionRate: workload ? Math.round((completedTasks.length / workload) * 100) : null,
    avgCycleDays: cycle.length ? Math.round((cycle.reduce((a, b) => a + b, 0) / cycle.length) * 10) / 10 : null,
    total: tasks.length,
    trend: trendRanges(period, anchor).map((r) => ({
      label: r.label,
      created: tasks.filter((t) => inRange(t.createdAt, r)).length,
      completed: tasks.filter((t) => inRange(t.completedAt, r)).length,
    })),
    byStatus: [...statusByName.values()].sort((a, b) => b.value - a.value),
    byPriority: [...PRIORITIES].reverse().map((p) => ({ key: p, label: PRIORITY_META[p].label, value: priorityCounts.get(p) ?? 0, color: PRIORITY_COLORS[p] })).filter((s) => s.value > 0),
    byAssignee: [...assigneeCounts.entries()]
      .map(([id, value]) => ({ key: id || 'none', label: id ? memberMap.get(id)?.name ?? 'Former member' : 'Unassigned', value, color: id ? memberMap.get(id)?.color ?? '#94a3b8' : '#94a3b8' }))
      .sort((a, b) => b.value - a.value),
    byProject: [...projectCounts.entries()]
      .map(([id, value]) => ({ key: id, label: projectMap.get(id)?.name ?? 'Project', value, color: projectMap.get(id)?.color ?? '#94a3b8' }))
      .sort((a, b) => b.value - a.value),
    byField,
    completedRows: completedTasks.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).map(row),
    createdRows: createdTasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(row),
    overdueRows: overdue.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')).map(row),
  };
}

const cell = (value: string | number) => {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The report as a spreadsheet: summary, breakdowns and every card listed. */
export function reportToCsv(report: Report, scope: string): string {
  const lines: (string | number)[][] = [
    ['ActivTrack report', scope],
    ['Period', report.range.label],
    ['Generated', format(new Date(), 'yyyy-MM-dd HH:mm')],
    [],
    ['Summary'],
    ['Created', report.created],
    ['Completed', report.completed],
    ['Open at end of period', report.openAtEnd],
    ['Overdue at end of period', report.overdueAtEnd],
    ['Completion rate % (completed / open at start + created)', report.completionRate ?? ''],
    ['Average days to complete', report.avgCycleDays ?? ''],
    ['Hours logged', Math.round((report.minutesLogged / 60) * 10) / 10],
    [],
    ['Trend', 'Created', 'Completed'],
    ...report.trend.map((t) => [t.label, t.created, t.completed]),
    [],
    ['Cards by status', 'Count'],
    ...report.byStatus.map((s) => [s.label, s.value]),
    [],
    ['Open cards by priority', 'Count'],
    ...report.byPriority.map((s) => [s.label, s.value]),
    [],
    ['Open cards by person', 'Count'],
    ...report.byAssignee.map((s) => [s.label, s.value]),
    [],
    ['Card', 'Project', 'Status', 'Priority', 'Assignee', 'Due date', 'Created', 'Completed', 'In report as'],
  ];
  const add = (rows: Row[], label: string) =>
    rows.forEach(({ task, project, status, assignee }) =>
      lines.push([task.title, project?.name ?? '', status?.name ?? '', PRIORITY_META[task.priority].label, assignee?.name ?? '', task.dueDate ?? '', task.createdAt.slice(0, 10), task.completedAt?.slice(0, 10) ?? '', label]),
    );
  add(report.completedRows, 'Completed');
  add(report.createdRows, 'Created');
  add(report.overdueRows, 'Overdue');
  return lines.map((l) => l.map(cell).join(',')).join('\r\n');
}

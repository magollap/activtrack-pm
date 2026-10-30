import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { differenceInCalendarDays } from 'date-fns';
import { Check, ChevronRight, Inbox, Sparkles } from 'lucide-react';
import { DueDate } from '@/components/DueDate';
import { EmptyState } from '@/components/EmptyState';
import { PriorityBadge } from '@/components/PriorityBadge';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useCurrentUser } from '@/features/auth/AuthProvider';
import { useQuery } from '@/hooks/useQuery';
import { useToast } from '@/hooks/useToast';
import { openAssistant } from '@/lib/commands';
import { canWrite, projectAccess } from '@/lib/db/access';
import { parseDay } from '@/lib/dates';
import { listMyMemberships } from '@/lib/db/projectMembers';
import { listProjects } from '@/lib/db/projects';
import { listStatuses } from '@/lib/db/statuses';
import { table } from '@/lib/db/tables';
import { updateTask } from '@/lib/db/tasks';
import { PRIORITY_META } from '@/lib/priority';
import type { Member, Project, Status, Task } from '@/lib/db/types';

interface Row {
  task: Task;
  project: Project;
  status: Status | undefined;
  doneStatus: Status | undefined;
  editable: boolean;
}

async function loadMyTasks(me: Member): Promise<Row[]> {
  const [projects, statuses, tasks, memberships] = await Promise.all([
    listProjects(),
    listStatuses(),
    table('tasks').list({ assigneeId: me.id }),
    listMyMemberships(me.id),
  ]);
  const projectMap = new Map(projects.filter((p) => !p.archivedAt).map((p) => [p.id, p]));
  const statusMap = new Map(statuses.map((s) => [s.id, s]));
  return tasks.flatMap((task) => {
    const project = projectMap.get(task.projectId);
    if (!project) return [];
    return [{
      task,
      project,
      status: statusMap.get(task.statusId),
      doneStatus: statuses.find((s) => s.projectId === project.id && s.isDone),
      editable: canWrite(projectAccess(project, me, memberships)),
    }];
  });
}

type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'none';
const BUCKETS: { id: Bucket; label: string; tone: string }[] = [
  { id: 'overdue', label: 'Overdue', tone: 'text-red-600 dark:text-red-400' },
  { id: 'today', label: 'Today', tone: 'text-gold-700 dark:text-gold-400' },
  { id: 'week', label: 'Next 7 days', tone: 'text-info-700 dark:text-info-300' },
  { id: 'later', label: 'Later', tone: 'text-slate-600 dark:text-slate-300' },
  { id: 'none', label: 'No due date', tone: 'text-slate-500 dark:text-slate-400' },
];

function bucketOf(task: Task): Bucket {
  const date = task.dueDate ? parseDay(task.dueDate) : null;
  if (!date) return 'none';
  const diff = differenceInCalendarDays(date, new Date());
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 7) return 'week';
  return 'later';
}

function TaskRow({ row }: { row: Row }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const isDone = row.status?.isDone ?? false;

  const complete = async () => {
    if (!row.doneStatus || busy) return;
    setBusy(true);
    try {
      await updateTask(row.task.id, { statusId: row.doneStatus.id });
      toast.success(`Moved to ${row.doneStatus.name}`);
    } catch (error) {
      toast.error(error);
      setBusy(false);
    }
  };

  return (
    <li className="group flex items-center gap-3 border-t border-slate-100 px-4 py-2.5 first:border-t-0 dark:border-slate-800">
      <button
        type="button"
        onClick={complete}
        disabled={!row.editable || isDone || busy || !row.doneStatus}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          isDone ? 'border-brand-600 bg-brand-600 text-brand-contrast' : 'border-slate-300 text-transparent hover:border-brand-500 hover:text-brand-500 dark:border-slate-600'
        } disabled:cursor-default`}
        aria-label={isDone ? 'Completed' : `Mark "${row.task.title}" as done`}
        title={row.doneStatus ? `Move to ${row.doneStatus.name}` : undefined}
      >
        <Check className="h-3 w-3" />
      </button>
      <Link to={`/projects/${row.project.id}?task=${row.task.id}`} className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-medium hover:text-brand-700 dark:hover:text-brand-300 ${isDone ? 'text-slate-400 line-through' : ''}`}>{row.task.title}</span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex min-w-0 items-center gap-1.5 truncate"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: row.project.color }} />{row.project.name}</span>
          {row.status && <span className="hidden items-center gap-1 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: row.status.color }} />{row.status.name}</span>}
        </span>
      </Link>
      <span className="hidden sm:inline"><PriorityBadge priority={row.task.priority} /></span>
      <span className="w-20 text-right"><DueDate dueDate={row.task.dueDate} isDone={isDone} /></span>
    </li>
  );
}

/** Everything assigned to the signed-in person across all projects, grouped by when it is due. */
export function MyTasksPage() {
  const me = useCurrentUser();
  const { data, loading, error } = useQuery(() => loadMyTasks(me), `my-tasks:${me.id}`);
  const [showDone, setShowDone] = useState(false);

  const { open, done, groups } = useMemo(() => {
    const rows = data ?? [];
    const openRows = rows.filter((r) => !r.status?.isDone);
    const doneRows = rows
      .filter((r) => r.status?.isDone)
      .sort((a, b) => (b.task.completedAt ?? '').localeCompare(a.task.completedAt ?? ''))
      .slice(0, 20);
    const sorted = [...openRows].sort(
      (a, b) =>
        (a.task.dueDate ?? '9999').localeCompare(b.task.dueDate ?? '9999') ||
        PRIORITY_META[b.task.priority].rank - PRIORITY_META[a.task.priority].rank,
    );
    return {
      open: openRows,
      done: doneRows,
      groups: BUCKETS.map((b) => ({ ...b, rows: sorted.filter((r) => bucketOf(r.task) === b.id) })).filter((g) => g.rows.length),
    };
  }, [data]);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">My tasks</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {open.length ? `${open.length} open task${open.length === 1 ? '' : 's'} assigned to you across all projects.` : 'Nothing open is assigned to you.'}
          </p>
        </div>
        <button className="btn-secondary" onClick={() => openAssistant('Add a card to ')}>
          <Sparkles className="h-4 w-4 text-gold-600 dark:text-gold-400" /> Add with AI
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="card">
          <EmptyState icon={Inbox} title="You're all clear" message="Cards assigned to you in any project show up here, sorted by due date." />
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.id} className="card overflow-hidden">
            <header className="flex items-center gap-2 px-4 py-3">
              <h3 className={`text-sm font-semibold ${group.tone}`}>{group.label}</h3>
              <span className="rounded-full bg-slate-100 px-2 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{group.rows.length}</span>
            </header>
            <ul className="border-t border-slate-100 dark:border-slate-800">
              {group.rows.map((row) => <TaskRow key={row.task.id} row={row} />)}
            </ul>
          </section>
        ))
      )}

      {done.length > 0 && (
        <section className="card overflow-hidden">
          <button onClick={() => setShowDone((s) => !s)} aria-expanded={showDone} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/40">
            <ChevronRight className={`h-4 w-4 transition-transform ${showDone ? 'rotate-90' : ''}`} /> Recently completed
            <span className="rounded-full bg-slate-100 px-2 text-xs font-medium dark:bg-slate-800">{done.length}</span>
          </button>
          {showDone && <ul className="border-t border-slate-100 dark:border-slate-800">{done.map((row) => <TaskRow key={row.task.id} row={row} />)}</ul>}
        </section>
      )}
    </div>
  );
}

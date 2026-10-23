import { History } from 'lucide-react';
import { timeAgo } from '@/lib/dates';
import { EmptyState } from '@/components/EmptyState';
import { useQuery } from '@/hooks/useQuery';
import { listTaskHistory } from '@/lib/db/history';
import type { HistoryField, TaskHistoryEntry } from '@/lib/db/types';

const FIELD_LABELS: Record<HistoryField, string> = {
  title: 'Title',
  status: 'Status',
  priority: 'Priority',
  assignee: 'Assignee',
  dueDate: 'Due date',
};

function describe(entry: TaskHistoryEntry): string {
  const label = FIELD_LABELS[entry.field] ?? entry.field;
  if (entry.field === 'assignee') {
    if (!entry.from) return `Assigned to ${entry.to}`;
    if (!entry.to) return `Unassigned from ${entry.from}`;
  }
  if (!entry.from) return `${label} set to ${entry.to}`;
  if (!entry.to) return `${label} cleared (was ${entry.from})`;
  return `${label} changed from ${entry.from} to ${entry.to}`;
}

export function HistoryTab({ taskId }: { taskId: string }) {
  const { data: entries = [], loading } = useQuery(() => listTaskHistory(taskId), `history:${taskId}`);

  if (!loading && entries.length === 0) {
    return <EmptyState compact icon={History} title="No changes yet" message="Changes to the title, status, priority, assignee and due date will appear here." />;
  }

  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-slate-700">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-brand-500 ring-4 ring-white dark:ring-slate-900" />
          <p className="text-sm">
            {describe(entry)}
            <span className="text-slate-400"> · {timeAgo(entry.createdAt)}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}

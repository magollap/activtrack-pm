import { Link } from 'react-router-dom';
import { PartyPopper } from 'lucide-react';
import { DueDate } from '@/components/DueDate';
import { PriorityBadge } from '@/components/PriorityBadge';
import { EmptyState } from '@/components/EmptyState';
import type { AttentionItem } from '@/features/home/loadDashboard';

export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  return (
    <section className="card">
      <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <h3 className="font-semibold">Needs attention</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Overdue and due-today tasks across all projects</p>
      </header>
      {items.length === 0 ? (
        <EmptyState compact icon={PartyPopper} title="All caught up" message="Nothing is overdue or due today." />
      ) : (
        <ul>
          {items.map(({ task, project, status }) => (
            <li key={task.id} className="border-t border-slate-100 first:border-t-0 dark:border-slate-800">
              <Link
                to={`/projects/${project.id}?task=${task.id}`}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: status?.color }} title={status?.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: project.color }} />
                    {project.name}
                  </p>
                </div>
                <span className="hidden sm:inline"><PriorityBadge priority={task.priority} /></span>
                <DueDate dueDate={task.dueDate} isDone={false} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

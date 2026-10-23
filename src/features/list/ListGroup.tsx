import { ChevronRight } from 'lucide-react';
import { ListRow } from '@/features/list/ListRow';
import type { Member, Status, Task } from '@/lib/db/types';

interface ListGroupProps {
  status: Status;
  tasks: Task[];
  statuses: Status[];
  members: Member[];
  editable: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onOpenTask: (taskId: string) => void;
}

export function ListGroup({ status, tasks, statuses, members, editable, collapsed, onToggle, onOpenTask }: ListGroupProps) {
  return (
    <section className="card overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
      >
        <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
        <span className="text-sm font-semibold">{status.name}</span>
        <span className="rounded-full bg-slate-100 px-2 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{tasks.length}</span>
      </button>
      {!collapsed && (
        tasks.length === 0 ? (
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400 dark:border-slate-800">No tasks</p>
        ) : (
          tasks.map((task) => (
            <ListRow key={task.id} task={task} statuses={statuses} members={members} isDone={status.isDone} editable={editable} onOpen={() => onOpenTask(task.id)} />
          ))
        )
      )}
    </section>
  );
}

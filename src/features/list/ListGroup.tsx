import { ChevronRight } from 'lucide-react';
import { ListRow } from '@/features/list/ListRow';
import type { CustomField, Member, Status, Task } from '@/lib/db/types';

interface ListGroupProps {
  status: Status;
  tasks: Task[];
  statuses: Status[];
  members: Member[];
  fields: CustomField[];
  editable: boolean;
  collapsed: boolean;
  selected: Set<string>;
  onSelect: (taskIds: string[], select: boolean) => void;
  onToggle: () => void;
  onOpenTask: (taskId: string) => void;
}

export function ListGroup({ status, tasks, statuses, members, fields, editable, collapsed, selected, onSelect, onToggle, onOpenTask }: ListGroupProps) {
  const ids = tasks.map((t) => t.id);
  const chosen = ids.filter((id) => selected.has(id)).length;
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center">
      {editable && tasks.length > 0 && (
        <input
          type="checkbox"
          checked={chosen === ids.length}
          ref={(el) => { if (el) el.indeterminate = chosen > 0 && chosen < ids.length; }}
          onChange={() => onSelect(ids, chosen !== ids.length)}
          className="ml-4 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-brand-600"
          aria-label={`Select all in ${status.name}`}
        />
      )}
      <button
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex min-w-0 flex-1 items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
      >
        <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
        <span className="text-sm font-semibold">{status.name}</span>
        <span className="rounded-full bg-slate-100 px-2 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{tasks.length}</span>
      </button>
      </div>
      {!collapsed && (
        tasks.length === 0 ? (
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400 dark:border-slate-800">No tasks</p>
        ) : (
          tasks.map((task) => (
            <ListRow
              key={task.id}
              task={task}
              statuses={statuses}
              members={members}
              fields={fields}
              isDone={status.isDone}
              editable={editable}
              selected={selected.has(task.id)}
              onSelect={() => onSelect([task.id], !selected.has(task.id))}
              onOpen={() => onOpenTask(task.id)}
            />
          ))
        )
      )}
    </section>
  );
}

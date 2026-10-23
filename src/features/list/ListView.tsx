import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { ListGroup } from '@/features/list/ListGroup';
import { sortTasks, type SortKey, type SortState } from '@/features/list/sortTasks';
import type { TaskViewProps } from '@/features/projects/taskViewProps';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'title', label: 'Task' },
  { key: 'manual', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'priority', label: 'Priority' },
  { key: 'dueDate', label: 'Due' },
];

export function ListView({ statuses, tasks, members, editable, onOpenTask }: TaskViewProps) {
  const [sort, setSort] = useState<SortState>({ key: 'manual', dir: 'asc' });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const sorted = useMemo(() => sortTasks(tasks, sort, memberMap), [tasks, sort, memberMap]);

  const toggleSort = (key: SortKey) => {
    if (key === 'manual') return setSort({ key: 'manual', dir: 'asc' });
    setSort((s) => (s.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : { key: 'manual', dir: 'asc' }) : { key, dir: 'asc' }));
  };
  const toggleGroup = (id: string) =>
    setCollapsed((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[minmax(0,1fr)_150px_170px_96px_100px] gap-x-3 px-4 text-xs font-medium text-slate-500 dark:text-slate-400 md:grid">
        {COLUMNS.map(({ key, label }) => {
          const active = sort.key === key && key !== 'manual';
          const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
          return key === 'manual' ? (
            <span key={label} className="px-1.5">{label}</span>
          ) : (
            <button key={key} onClick={() => toggleSort(key)} className={`inline-flex items-center gap-1 px-1.5 text-left hover:text-slate-900 dark:hover:text-white ${active ? 'text-slate-900 dark:text-white' : ''}`}>
              {label} <Icon className={`h-3 w-3 ${active ? '' : 'opacity-40'}`} />
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 md:hidden">
        <label htmlFor="mobile-sort" className="text-xs text-slate-500">Sort by</label>
        <select
          id="mobile-sort"
          className="input w-auto py-1 text-xs"
          value={`${sort.key}:${sort.dir}`}
          onChange={(e) => {
            const [key, dir] = e.target.value.split(':') as [SortKey, 'asc' | 'desc'];
            setSort({ key, dir });
          }}
        >
          <option value="manual:asc">Board order</option>
          <option value="title:asc">Title A-Z</option>
          <option value="priority:desc">Priority, highest first</option>
          <option value="dueDate:asc">Due date, soonest first</option>
          <option value="assignee:asc">Assignee</option>
        </select>
      </div>
      {statuses.map((status) => (
        <ListGroup
          key={status.id}
          status={status}
          tasks={sorted.filter((t) => t.statusId === status.id)}
          statuses={statuses}
          members={members}
          editable={editable}
          collapsed={collapsed.has(status.id)}
          onToggle={() => toggleGroup(status.id)}
          onOpenTask={onOpenTask}
        />
      ))}
    </div>
  );
}

import type { Member, Task } from '@/lib/db/types';
import { PRIORITY_META } from '@/lib/priority';

export type SortKey = 'manual' | 'title' | 'priority' | 'assignee' | 'dueDate';
export interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}

export function sortTasks(tasks: Task[], sort: SortState, members: Map<string, Member>): Task[] {
  if (sort.key === 'manual') return tasks;
  const sign = sort.dir === 'asc' ? 1 : -1;
  const value = (t: Task): string | number | null => {
    switch (sort.key) {
      case 'title':
        return t.title.toLowerCase();
      case 'priority':
        return PRIORITY_META[t.priority].rank;
      case 'assignee':
        return t.assigneeId ? members.get(t.assigneeId)?.name.toLowerCase() ?? null : null;
      case 'dueDate':
        return t.dueDate;
      default:
        return null;
    }
  };
  return [...tasks].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    // Empty values always sink to the bottom regardless of direction.
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return (va < vb ? -1 : va > vb ? 1 : 0) * sign;
  });
}

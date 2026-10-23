import { isThisWeek } from 'date-fns';
import { dueTone, parseDay } from '@/lib/dates';
import type { TaskFilters } from '@/lib/prefs';
import type { Status, Task } from '@/lib/db/types';

export const UNASSIGNED = '__unassigned__';

export function countActiveFilters(filters: TaskFilters): number {
  return (
    (filters.text.trim() ? 1 : 0) +
    (filters.statusIds.length ? 1 : 0) +
    (filters.priorities.length ? 1 : 0) +
    (filters.assigneeIds.length ? 1 : 0) +
    (filters.due !== 'any' ? 1 : 0)
  );
}

export function applyFilters(tasks: Task[], filters: TaskFilters, statuses: Status[]): Task[] {
  const doneIds = new Set(statuses.filter((s) => s.isDone).map((s) => s.id));
  const text = filters.text.trim().toLowerCase();

  return tasks.filter((task) => {
    if (text && !`${task.title} ${task.description}`.toLowerCase().includes(text)) return false;
    if (filters.statusIds.length && !filters.statusIds.includes(task.statusId)) return false;
    if (filters.priorities.length && !filters.priorities.includes(task.priority)) return false;
    if (filters.assigneeIds.length && !filters.assigneeIds.includes(task.assigneeId ?? UNASSIGNED)) return false;
    const isDone = doneIds.has(task.statusId);
    switch (filters.due) {
      case 'overdue':
        return dueTone(task.dueDate, isDone) === 'overdue';
      case 'today':
        return dueTone(task.dueDate, false) === 'today';
      case 'week': {
        const date = task.dueDate ? parseDay(task.dueDate) : null;
        return date !== null && isThisWeek(date);
      }
      case 'none':
        return !task.dueDate;
      default:
        return true;
    }
  });
}

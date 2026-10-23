import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';

export function toDayString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function todayString(): string {
  return toDayString(new Date());
}

export function parseDay(day: string): Date | null {
  const date = parseISO(day);
  return isValid(date) ? date : null;
}

export type DueTone = 'overdue' | 'today' | 'normal';

export function dueTone(dueDate: string | null, isDone: boolean): DueTone {
  if (!dueDate || isDone) return 'normal';
  const date = parseDay(dueDate);
  if (!date) return 'normal';
  const diff = differenceInCalendarDays(date, new Date());
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return 'normal';
}

export function formatDay(day: string | null): string {
  if (!day) return 'No date';
  const date = parseDay(day);
  if (!date) return 'No date';
  const diff = differenceInCalendarDays(date, new Date());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return format(date, sameYear ? 'MMM d' : 'MMM d, yyyy');
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)}d ago`;
  return format(new Date(iso), 'MMM d, yyyy');
}

export function formatDayLong(day: string | null): string | null {
  if (!day) return null;
  const date = parseDay(day);
  return date ? format(date, 'MMM d, yyyy') : null;
}

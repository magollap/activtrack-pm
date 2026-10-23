import type { Priority } from '@/lib/db/types';

export const PRIORITY_META: Record<Priority, { label: string; rank: number; className: string; dot: string }> = {
  low: {
    label: 'Low',
    rank: 0,
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  medium: {
    label: 'Medium',
    rank: 1,
    className: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  high: {
    label: 'High',
    rank: 2,
    className: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  urgent: {
    label: 'Urgent',
    rank: 3,
    className: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
    dot: 'bg-red-500',
  },
};

import { CalendarDays } from 'lucide-react';
import { dueTone, formatDay } from '@/lib/dates';

const TONES = {
  overdue: 'text-red-600 dark:text-red-400 font-medium',
  today: 'text-amber-600 dark:text-amber-400 font-medium',
  normal: 'text-slate-500 dark:text-slate-400',
};

export function DueDate({ dueDate, isDone }: { dueDate: string | null; isDone: boolean }) {
  if (!dueDate) return null;
  const tone = dueTone(dueDate, isDone);
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${TONES[tone]}`} title={tone === 'overdue' ? 'Overdue' : undefined}>
      <CalendarDays className="h-3.5 w-3.5" />
      {formatDay(dueDate)}
    </span>
  );
}

import { differenceInCalendarDays, format, subDays } from 'date-fns';
import { table } from '@/lib/db/tables';
import { isMissingTable } from '@/lib/db/fields';
import { parseDay } from '@/lib/dates';
import { HEALTH_VALUES, type Health, type Status, type StatusUpdate, type Task } from '@/lib/db/types';

export const HEALTH_META: Record<Health, { label: string; className: string; dot: string }> = {
  on_track: { label: 'On track', className: 'bg-brand-50 text-brand-800 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30', dot: 'bg-[#0a8c4e]' },
  at_risk: { label: 'At risk', className: 'bg-gold-50 text-gold-800 ring-gold-200 dark:bg-gold-500/10 dark:text-gold-300 dark:ring-gold-500/30', dot: 'bg-[#c9a227]' },
  off_track: { label: 'Off track', className: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30', dot: 'bg-[#e11d48]' },
  complete: { label: 'Complete', className: 'bg-info-50 text-info-700 ring-info-200 dark:bg-info-500/10 dark:text-info-300 dark:ring-info-500/30', dot: 'bg-[#2550e8]' },
};

const UPDATE_NEEDED = 'Status updates need a one-time database update. Run supabase/migrations/20261031120000_automations_status_time_files.sql in the Supabase SQL Editor.';

/** Newest first. Empty on databases without the status updates table yet. */
export async function listStatusUpdates(projectId?: string): Promise<StatusUpdate[]> {
  try {
    const rows = await table('statusUpdates').list(projectId ? { projectId } : undefined);
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

export interface StatusUpdateInput {
  health: Health;
  title: string;
  body: string;
}

function clean(input: StatusUpdateInput): StatusUpdateInput {
  if (!HEALTH_VALUES.includes(input.health)) throw new Error('Choose how the project is going.');
  const title = input.title.trim().slice(0, 120);
  if (!title) throw new Error('Give the update a title.');
  return { health: input.health, title, body: input.body.trim().slice(0, 10000) };
}

export async function postStatusUpdate(projectId: string, input: StatusUpdateInput): Promise<StatusUpdate> {
  try {
    return await table('statusUpdates').insert({ ...clean(input), projectId });
  } catch (error) {
    if (isMissingTable(error)) throw new Error(UPDATE_NEEDED);
    throw error;
  }
}

export const editStatusUpdate = (id: string, input: StatusUpdateInput): Promise<StatusUpdate> => table('statusUpdates').update(id, { ...clean(input) });

export async function deleteStatusUpdate(id: string): Promise<void> {
  await table('statusUpdates').remove({ id });
}

/** A ready-to-edit update written from the project's cards: what finished, what is late, what is next. */
export function draftStatusUpdate(tasks: Task[], statuses: Status[], now = new Date()): StatusUpdateInput {
  const done = new Set(statuses.filter((s) => s.isDone).map((s) => s.id));
  const weekAgo = subDays(now, 7);
  const open = tasks.filter((t) => !done.has(t.statusId));
  const finished = tasks.filter((t) => t.completedAt && new Date(t.completedAt) >= weekAgo);
  const overdue = open.filter((t) => {
    const due = t.dueDate ? parseDay(t.dueDate) : null;
    return due !== null && differenceInCalendarDays(due, now) < 0;
  });
  const upcoming = open
    .filter((t) => {
      const due = t.dueDate ? parseDay(t.dueDate) : null;
      const diff = due ? differenceInCalendarDays(due, now) : -1;
      return diff >= 0 && diff <= 7;
    })
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));

  const health: Health = !open.length && tasks.length ? 'complete' : overdue.length > Math.max(2, open.length * 0.2) ? 'off_track' : overdue.length ? 'at_risk' : 'on_track';
  const percent = tasks.length ? Math.round(((tasks.length - open.length) / tasks.length) * 100) : 0;
  const list = (items: Task[], extra: (t: Task) => string = () => '') => items.slice(0, 8).map((t) => `- ${t.title}${extra(t)}`).join('\n') + (items.length > 8 ? `\n- and ${items.length - 8} more` : '');

  const sections = [
    `Summary: ${percent}% of cards are done (${tasks.length - open.length} of ${tasks.length}). ${finished.length} finished in the last 7 days, ${open.length} still open${overdue.length ? `, ${overdue.length} overdue` : ''}.`,
    finished.length ? `Finished this week:\n${list(finished)}` : '',
    overdue.length ? `Overdue:\n${list(overdue, (t) => ` (due ${format(parseDay(t.dueDate!)!, 'MMM d')})`)}` : '',
    upcoming.length ? `Coming up in the next 7 days:\n${list(upcoming, (t) => ` (due ${format(parseDay(t.dueDate!)!, 'MMM d')})`)}` : '',
  ].filter(Boolean);

  return { health, title: `Week of ${format(now, 'MMM d, yyyy')}`, body: sections.join('\n\n') };
}

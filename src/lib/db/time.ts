import { table } from '@/lib/db/tables';
import { isMissingTable } from '@/lib/db/fields';
import type { TimeEntry } from '@/lib/db/types';

const UPDATE_NEEDED = 'Time tracking needs a one-time database update. Run supabase/migrations/20261031120000_automations_status_time_files.sql in the Supabase SQL Editor.';

const minutesBetween = (start: string, end: Date | string) => Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));

/** Minutes for an entry; a running timer counts up to now. */
export const entryMinutes = (entry: TimeEntry, now = new Date()): number => (entry.endedAt ? entry.minutes : minutesBetween(entry.startedAt, now));

export async function listTimeEntries(taskIds?: string | string[]): Promise<TimeEntry[]> {
  if (Array.isArray(taskIds) && !taskIds.length) return [];
  try {
    const rows = await table('timeEntries').list(taskIds ? { taskId: taskIds } : undefined);
    return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

async function insert(row: Partial<TimeEntry>): Promise<TimeEntry> {
  try {
    return await table('timeEntries').insert(row);
  } catch (error) {
    if (isMissingTable(error)) throw new Error(UPDATE_NEEDED);
    throw error;
  }
}

/** Starts a timer on a card, stopping any timer the person has running elsewhere first. */
export async function startTimer(taskId: string, userId: string): Promise<TimeEntry> {
  const running = (await table('timeEntries').list({ userId, endedAt: null }).catch(() => [])) as TimeEntry[];
  for (const entry of running) await stopTimer(entry);
  return insert({ taskId, startedAt: new Date().toISOString(), endedAt: null, minutes: 0, note: '' });
}

export async function stopTimer(entry: TimeEntry): Promise<TimeEntry> {
  const now = new Date();
  return table('timeEntries').update(entry.id, { endedAt: now.toISOString(), minutes: Math.max(1, minutesBetween(entry.startedAt, now)) });
}

export async function logTime(taskId: string, minutes: number, note: string, day: string): Promise<TimeEntry> {
  if (!Number.isFinite(minutes) || minutes <= 0) throw new Error('Enter the time spent, like 1h 30m.');
  if (minutes > 24 * 60) throw new Error('One entry can be at most 24 hours.');
  const end = new Date(`${day}T17:00:00`);
  const start = new Date(end.getTime() - minutes * 60000);
  return insert({ taskId, startedAt: start.toISOString(), endedAt: end.toISOString(), minutes: Math.round(minutes), note: note.trim().slice(0, 500) });
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const removed = await table('timeEntries').remove({ id });
  if (!removed) throw new Error('You can only delete your own time entries.');
}

/** Reads "1h 30m", "90m", "1.5h", "1:30" or "45" (minutes). Returns null when it cannot. */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const clock = t.match(/^(\d{1,2}):(\d{2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t));
  let total = 0;
  let found = false;
  for (const [, value, unit] of t.matchAll(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?)/g)) {
    found = true;
    total += unit.startsWith('h') ? Number(value) * 60 : Number(value);
  }
  return found ? Math.round(total) : null;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

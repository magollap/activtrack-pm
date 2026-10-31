import { PRIORITIES, type Priority } from '@/lib/db/types';

const PREFS_PREFIX = 'workday:prefs:';

export type Theme = 'light' | 'dark';
export type ProjectView = 'board' | 'list' | 'calendar' | 'timeline';
export type DueFilter = 'any' | 'overdue' | 'today' | 'week' | 'none';

export interface TaskFilters {
  text: string;
  statusIds: string[];
  priorities: Priority[];
  assigneeIds: string[];
  due: DueFilter;
}

export const EMPTY_FILTERS: TaskFilters = { text: '', statusIds: [], priorities: [], assigneeIds: [], due: 'any' };

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(PREFS_PREFIX + key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFS_PREFIX + key, JSON.stringify(value));
  } catch {
    // Preferences are a convenience; ignore a full storage quota here.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(PREFS_PREFIX + key);
  } catch {
    // Ignore storage that is unavailable (private mode, blocked site data).
  }
}

const stringArray =(value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/** The saved choice; null means "follow the device". */
export function getTheme(): Theme | null {
  const value = read('theme');
  return value === 'light' || value === 'dark' ? value : null;
}

export function setTheme(theme: Theme | null): void {
  if (theme) write('theme', theme);
  else remove('theme');
}

export function getProjectView(projectId: string): ProjectView {
  const value = read(`view:${projectId}`);
  return value === 'list' || value === 'calendar' || value === 'timeline' ? value : 'board';
}

export const setProjectView = (projectId: string, view: ProjectView): void => write(`view:${projectId}`, view);

export function getProjectFilters(projectId: string): TaskFilters {
  const value = read(`filters:${projectId}`);
  if (typeof value !== 'object' || value === null) return EMPTY_FILTERS;
  const v = value as Record<string, unknown>;
  const due = ['overdue', 'today', 'week', 'none'].includes(String(v.due)) ? (v.due as DueFilter) : 'any';
  return {
    text: typeof v.text === 'string' ? v.text : '',
    statusIds: stringArray(v.statusIds),
    priorities: stringArray(v.priorities).filter((p): p is Priority => (PRIORITIES as readonly string[]).includes(p)),
    assigneeIds: stringArray(v.assigneeIds),
    due,
  };
}

export const setProjectFilters = (projectId: string, filters: TaskFilters): void =>
  write(`filters:${projectId}`, filters);

import { table } from '@/lib/db/tables';
import { subscribe } from '@/lib/db/events';
import { isMissingTable } from '@/lib/db/fields';
import { toDayString } from '@/lib/dates';
import { addDays } from 'date-fns';
import { PRIORITIES, type Automation, type AutomationAction, type AutomationTrigger, type Task } from '@/lib/db/types';

export interface AutomationInput {
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
}

const UPDATE_NEEDED = 'Automations need a one-time database update. Run supabase/migrations/20261031120000_automations_status_time_files.sql in the Supabase SQL Editor.';

// Rules are read on every card change, so keep them for a short while per project.
const cache = new Map<string, { at: number; rules: Automation[] }>();
subscribe((collection) => {
  if (collection === 'automations') cache.clear();
});

export async function listAutomations(projectId: string): Promise<Automation[]> {
  try {
    const rows = await table('automations').list({ projectId });
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

async function activeRules(projectId: string): Promise<Automation[]> {
  const hit = cache.get(projectId);
  if (hit && Date.now() - hit.at < 30_000) return hit.rules;
  const rules = (await listAutomations(projectId)).filter((r) => r.enabled);
  cache.set(projectId, { at: Date.now(), rules });
  return rules;
}

function clean(input: AutomationInput): AutomationInput {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error('Please name the automation.');
  if (!input.actions.length) throw new Error('Add at least one action.');
  if (input.actions.length > 10) throw new Error('An automation can have at most 10 actions.');
  const actions = input.actions.map((a): AutomationAction => {
    switch (a.type) {
      case 'set_due_in_days':
        return { type: a.type, days: Math.max(0, Math.min(365, Math.round(Number(a.days) || 0))) };
      case 'add_checklist': {
        const items = a.items.map((i) => i.trim().slice(0, 300)).filter(Boolean).slice(0, 20);
        if (!items.length) throw new Error('Add at least one checklist item.');
        return { type: a.type, items };
      }
      case 'add_comment': {
        const text = a.text.trim().slice(0, 2000);
        if (!text) throw new Error('Write the comment to add.');
        return { type: a.type, text };
      }
      case 'set_priority':
        if (!PRIORITIES.includes(a.priority)) throw new Error('Choose a priority.');
        return a;
      case 'move_to_status':
        if (!a.statusId) throw new Error('Choose a status to move to.');
        return a;
      default:
        return a;
    }
  });
  return { name, enabled: input.enabled, trigger: input.trigger, actions };
}

export async function createAutomation(projectId: string, input: AutomationInput): Promise<Automation> {
  try {
    return await table('automations').insert({ ...clean(input), projectId });
  } catch (error) {
    if (isMissingTable(error)) throw new Error(UPDATE_NEEDED);
    throw error;
  }
}

export const updateAutomation = (id: string, input: AutomationInput): Promise<Automation> => table('automations').update(id, { ...clean(input) });

export const setAutomationEnabled = (id: string, enabled: boolean): Promise<Automation> => table('automations').update(id, { enabled });

export async function deleteAutomation(id: string): Promise<void> {
  await table('automations').remove({ id });
}

// ---------------------------------------------------------------- engine

type Listener = (ran: { rule: string; task: string }[]) => void;
const listeners = new Set<Listener>();
/** Lets the screen tell people which automations just ran. */
export function onAutomationsRan(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function matches(trigger: AutomationTrigger, before: Task | null, after: Task): boolean {
  switch (trigger.type) {
    case 'task_created':
      return before === null;
    case 'status_changed':
      return after.statusId === trigger.statusId && before?.statusId !== trigger.statusId;
    case 'priority_changed':
      return after.priority === trigger.priority && before?.priority !== trigger.priority;
    default:
      return false;
  }
}

/**
 * Runs the project's enabled automations after a card is created (before = null) or changed.
 * Actions are written straight to the tables, so they never trigger further automations (no loops).
 * Runs with the signed-in person's permissions; a failing rule never undoes the change that triggered it.
 */
export async function runAutomations(before: Task | null, after: Task): Promise<void> {
  let rules: Automation[];
  try {
    rules = (await activeRules(after.projectId)).filter((r) => matches(r.trigger, before, after));
  } catch {
    return;
  }
  if (!rules.length) return;

  const patch: Record<string, unknown> = {};
  const checklist: string[] = [];
  const comments: string[] = [];
  for (const rule of rules) {
    for (const action of rule.actions) {
      switch (action.type) {
        case 'set_assignee':
          patch.assigneeId = action.assignee === 'creator' ? after.createdBy : action.assignee;
          break;
        case 'set_priority':
          patch.priority = action.priority;
          break;
        case 'move_to_status':
          if (action.statusId !== after.statusId) patch.statusId = action.statusId;
          break;
        case 'set_due_in_days':
          patch.dueDate = toDayString(addDays(new Date(), action.days));
          break;
        case 'add_checklist':
          checklist.push(...action.items);
          break;
        case 'add_comment':
          comments.push(action.text);
          break;
      }
    }
  }

  try {
    if (typeof patch.statusId === 'string') {
      const [status] = await table('statuses').list({ id: patch.statusId });
      if (!status || status.projectId !== after.projectId) delete patch.statusId;
      else {
        const siblings = await table('tasks').list({ statusId: status.id });
        patch.order = Math.max(-1, ...siblings.map((t) => t.order)) + 1;
        patch.completedAt = status.isDone ? after.completedAt ?? new Date().toISOString() : null;
      }
    }
    if (Object.keys(patch).length) await table('tasks').update(after.id, patch);
    if (checklist.length) {
      const existing = await table('checklistItems').list({ taskId: after.id });
      const start = Math.max(-1, ...existing.map((i) => i.order)) + 1;
      const have = new Set(existing.map((i) => i.text.toLowerCase()));
      const fresh = checklist.filter((text) => !have.has(text.toLowerCase()));
      await table('checklistItems').insertMany(fresh.map((text, i) => ({ taskId: after.id, text, done: false, order: start + i })));
    }
    for (const body of comments) await table('comments').insert({ taskId: after.id, body: `Automation: ${body}` });
    listeners.forEach((l) => l(rules.map((r) => ({ rule: r.name, task: after.title }))));
  } catch (error) {
    console.warn('An automation could not finish:', error);
  }
}

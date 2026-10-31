import { table } from '@/lib/db/tables';
import { runAutomations } from '@/lib/db/automations';
import { listFields, withoutLockedValues } from '@/lib/db/fields';
import { parseDay } from '@/lib/dates';
import { PRIORITIES, type FieldValue, type Priority, type Status, type Task } from '@/lib/db/types';

export interface TaskInput {
  title: string;
  statusId: string;
  description?: string;
  priority?: Priority;
  assigneeId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  customValues?: Record<string, FieldValue>;
}

export type TaskPatch = Partial<
  Pick<Task, 'title' | 'description' | 'statusId' | 'priority' | 'assigneeId' | 'startDate' | 'dueDate' | 'customValues'>
>;

function cleanValues(values: Record<string, FieldValue>): Record<string, FieldValue> {
  if (JSON.stringify(values).length > 20000) throw new Error('These custom field values are too long.');
  return values;
}

async function requireStatus(projectId: string, statusId: string): Promise<Status> {
  const status = await table('statuses').find(statusId);
  if (!status || status.projectId !== projectId) throw new Error('That status does not belong to this project.');
  return status;
}

function cleanTitle(title: string): string {
  const value = title.trim();
  if (!value) throw new Error('Tasks need a title.');
  if (value.length > 200) throw new Error('Task titles can be at most 200 characters.');
  return value;
}

function cleanDay(day: string | null | undefined): string | null {
  if (!day) return null;
  if (!parseDay(day)) throw new Error('Please enter a valid date.');
  return day;
}

async function nextOrder(statusId: string): Promise<number> {
  const tasks = await table('tasks').list({ statusId });
  return Math.max(-1, ...tasks.map((t) => t.order)) + 1;
}

const nowIso = () => new Date().toISOString();

export async function listTasks(projectId?: string): Promise<Task[]> {
  const tasks = await table('tasks').list(projectId ? { projectId } : undefined);
  return tasks.sort((a, b) => a.order - b.order);
}

export const getTask = (id: string): Promise<Task | null> => table('tasks').find(id);

export async function createTask(projectId: string, input: TaskInput): Promise<Task> {
  const status = await requireStatus(projectId, input.statusId);
  const priority = input.priority ?? 'medium';
  if (!PRIORITIES.includes(priority)) throw new Error('Unknown priority.');
  const created = await table('tasks').insert({
    projectId,
    title: cleanTitle(input.title),
    description: (input.description ?? '').slice(0, 10000),
    statusId: status.id,
    priority,
    assigneeId: input.assigneeId || null,
    startDate: cleanDay(input.startDate),
    dueDate: cleanDay(input.dueDate),
    order: await nextOrder(status.id),
    completedAt: status.isDone ? nowIso() : null,
    // Only sent when used, so databases without the custom fields column keep working.
    ...(input.customValues && Object.keys(input.customValues).length ? { customValues: cleanValues(input.customValues) } : {}),
  });
  await runAutomations(null, created);
  return created;
}

/** Change history is written by the server, so it cannot be forged or skipped. */
export async function updateTask(id: string, patch: TaskPatch): Promise<Task> {
  const task = await getTask(id);
  if (!task) throw new Error('This task no longer exists.');
  const next: TaskPatch & Partial<Pick<Task, 'completedAt' | 'order'>> = {};

  if (patch.title !== undefined) next.title = cleanTitle(patch.title);
  if (patch.description !== undefined) next.description = patch.description.slice(0, 10000);
  if (patch.priority !== undefined && patch.priority !== task.priority) {
    if (!PRIORITIES.includes(patch.priority)) throw new Error('Unknown priority.');
    next.priority = patch.priority;
  }
  if (patch.assigneeId !== undefined) next.assigneeId = patch.assigneeId || null;
  if (patch.startDate !== undefined) next.startDate = cleanDay(patch.startDate);
  if (patch.dueDate !== undefined) next.dueDate = cleanDay(patch.dueDate);
  if (patch.customValues !== undefined) next.customValues = cleanValues(patch.customValues);
  if (patch.statusId !== undefined && patch.statusId !== task.statusId) {
    const status = await requireStatus(task.projectId, patch.statusId);
    next.statusId = status.id;
    next.order = await nextOrder(status.id);
    next.completedAt = status.isDone ? task.completedAt ?? nowIso() : null;
  }
  const updated = await table('tasks').update(id, next);
  if (next.statusId !== undefined || next.priority !== undefined) await runAutomations(task, updated);
  return updated;
}

export async function moveTask(id: string, statusId: string, orderedIds: string[]): Promise<void> {
  const task = await getTask(id);
  if (!task) throw new Error('This task no longer exists.');
  if (task.statusId !== statusId) await updateTask(id, { statusId });
  const inStatus = (await table('tasks').list({ statusId })).sort((a, b) => a.order - b.order);
  const ids = new Set(inStatus.map((t) => t.id));
  // Tasks hidden by filters keep their relative order after the visible ones.
  const visible = orderedIds.filter((tid) => ids.has(tid));
  const rest = inStatus.map((t) => t.id).filter((tid) => !visible.includes(tid));
  const current = new Map(inStatus.map((t) => [t.id, t.order]));
  await table('tasks').updateMany(
    [...visible, ...rest]
      .map((tid, order) => ({ id: tid, patch: { order } }))
      .filter((p) => current.get(p.id) !== p.patch.order),
  );
}

/**
 * Copies a card (and its checklist, unticked) into the same column, right after the original's column order.
 * People who can't set locked fields (see fields.ts) get the copy without those values.
 */
export async function duplicateTask(id: string, canSetLockedFields = true): Promise<Task> {
  const task = await getTask(id);
  if (!task) throw new Error('This task no longer exists.');
  const customValues = canSetLockedFields ? task.customValues : withoutLockedValues(task.customValues, await listFields(task.projectId));
  const copy = await createTask(task.projectId, {
    title: `${task.title.slice(0, 193)} (copy)`,
    statusId: task.statusId,
    description: task.description,
    priority: task.priority,
    assigneeId: task.assigneeId,
    startDate: task.startDate,
    dueDate: task.dueDate,
    customValues,
  });
  const items = (await table('checklistItems').list({ taskId: id })).sort((a, b) => a.order - b.order);
  await table('checklistItems').insertMany(items.map((item) => ({ taskId: copy.id, text: item.text, done: false, order: item.order })));
  return copy;
}

/** Checklist items, comments and history go with the task. */
export async function deleteTask(id: string): Promise<void> {
  const removed = await table('tasks').remove({ id });
  if (!removed) throw new Error('You do not have permission to delete this task.');
}

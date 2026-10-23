import { table } from '@/lib/db/tables';
import { isHexColor } from '@/lib/colors';
import type { Status } from '@/lib/db/types';

export interface StatusInput {
  name: string;
  color: string;
  isDone: boolean;
}

function clean(input: StatusInput): StatusInput {
  const name = input.name.trim();
  if (!name) throw new Error('Please enter a status name.');
  if (name.length > 40) throw new Error('Status names can be at most 40 characters.');
  if (!isHexColor(input.color)) throw new Error('Please pick a color.');
  return { name, color: input.color, isDone: input.isDone };
}

function byOrder(a: Status, b: Status): number {
  return a.order - b.order;
}

const nowIso = () => new Date().toISOString();

async function projectStatuses(projectId: string): Promise<Status[]> {
  return (await table('statuses').list({ projectId })).sort(byOrder);
}

export async function listStatuses(projectId?: string): Promise<Status[]> {
  return projectId ? projectStatuses(projectId) : (await table('statuses').list()).sort(byOrder);
}

export async function createStatus(projectId: string, input: StatusInput): Promise<Status> {
  const existing = await projectStatuses(projectId);
  const order = existing.length ? existing[existing.length - 1].order + 1 : 0;
  return table('statuses').insert({ ...clean(input), projectId, order });
}

export async function updateStatus(id: string, input: StatusInput): Promise<Status> {
  const status = await table('statuses').find(id);
  if (!status) throw new Error('This status no longer exists.');
  const next = clean(input);
  if (status.isDone && !next.isDone) {
    const otherDone = (await projectStatuses(status.projectId)).some((s) => s.id !== id && s.isDone);
    if (!otherDone) throw new Error('At least one status must be marked as done.');
  }
  const updated = await table('statuses').update(id, next);
  if (status.isDone !== next.isDone) {
    const completedAt = next.isDone ? nowIso() : null;
    const tasks = await table('tasks').list({ statusId: id });
    await table('tasks').updateMany(tasks.map((t) => ({ id: t.id, patch: { completedAt } })));
  }
  return updated;
}

export async function reorderStatuses(projectId: string, orderedIds: string[]): Promise<void> {
  const owned = new Set((await projectStatuses(projectId)).map((s) => s.id));
  await table('statuses').updateMany(
    orderedIds.filter((id) => owned.has(id)).map((id, order) => ({ id, patch: { order } })),
  );
}

export const countTasksInStatus = async (statusId: string): Promise<number> =>
  (await table('tasks').list({ statusId })).length;

export async function deleteStatus(id: string, moveTasksTo: string | null): Promise<void> {
  const status = await table('statuses').find(id);
  if (!status) return;
  const siblings = (await projectStatuses(status.projectId)).filter((s) => s.id !== id);
  if (!siblings.length) throw new Error('A project needs at least one status.');
  if (status.isDone && !siblings.some((s) => s.isDone)) {
    throw new Error('Mark another status as done before deleting this one.');
  }
  const tasks = await table('tasks').list({ statusId: id });
  if (tasks.length) {
    const target = siblings.find((s) => s.id === moveTasksTo);
    if (!target) throw new Error('Choose where to move the tasks in this status.');
    const lastOrder = Math.max(-1, ...(await table('tasks').list({ statusId: target.id })).map((t) => t.order));
    await table('tasks').updateMany(tasks.map((t, i) => ({
      id: t.id,
      patch: {
        statusId: target.id,
        order: lastOrder + 1 + i,
        completedAt: target.isDone ? t.completedAt ?? nowIso() : null,
      },
    })));
  }
  await table('statuses').remove({ id });
}

import { format } from 'date-fns';
import { backend } from '@/lib/backend';
import { parseDay, todayString } from '@/lib/dates';
import { createTask, updateTask, type TaskPatch } from '@/lib/db/tasks';
import { PRIORITIES, type Member, type Priority } from '@/lib/db/types';
import { findMember, findStatus, findTask } from '@/lib/ai/match';
import { planLocally } from '@/lib/ai/localPlanner';
import type { AiAction, AiPlan, ResolvedAction, TaskChanges } from '@/lib/ai/types';
import type { ProjectData } from '@/hooks/useProjectData';

export interface AiStatus {
  enabled: boolean;
  provider: string | null;
}

let statusCache: Promise<AiStatus> | null = null;

/** Whether the server has an AI provider configured. Without one the built-in parser is used. */
export function aiStatus(): Promise<AiStatus> {
  statusCache ??= fetch('/api/ai', { headers: { Accept: 'application/json' }, cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) return { enabled: false, provider: null };
      const body: unknown = await response.json();
      const b = body as Partial<AiStatus>;
      return { enabled: b.enabled === true, provider: typeof b.provider === 'string' ? b.provider : null };
    })
    .catch(() => ({ enabled: false, provider: null }));
  return statusCache;
}

function buildContext(data: ProjectData, me: Member) {
  const statusName = new Map(data.statuses.map((s) => [s.id, s.name]));
  const memberName = new Map(data.members.map((m) => [m.id, m.name]));
  return {
    today: todayString(),
    weekday: format(new Date(), 'EEEE'),
    project: data.project.name,
    me: me.name,
    statuses: data.statuses.map((s) => ({ id: s.id, name: s.name, isDone: s.isDone })),
    members: data.members.map((m) => ({ id: m.id, name: m.name })),
    // Most recently updated first, so the cards people are talking about make the cut on big boards.
    tasks: [...data.tasks]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 400)
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: statusName.get(t.statusId) ?? '',
        priority: t.priority,
        assignee: t.assigneeId ? memberName.get(t.assigneeId) ?? '' : '',
        due: t.dueDate ?? '',
      })),
  };
}

/** Asks the server's AI to plan the request, falling back to the built-in parser when AI is off or unreachable. */
export async function planRequest(prompt: string, data: ProjectData, me: Member): Promise<AiPlan & { note?: string }> {
  const local = () => planLocally(prompt, { statuses: data.statuses, tasks: data.tasks, members: data.members, me });
  const status = await aiStatus();
  if (!status.enabled) return local();

  let response: Response;
  try {
    response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(await backend().apiHeaders()) },
      body: JSON.stringify({ prompt, context: buildContext(data, me) }),
    });
  } catch {
    return { ...local(), note: 'Could not reach the AI, so the built-in commands were used.' };
  }
  const body: unknown = await response.json().catch(() => null);
  const error = (body as { error?: unknown } | null)?.error;
  if (!response.ok) {
    if (response.status === 501) return local();
    if (response.status >= 500) return { ...local(), note: `${typeof error === 'string' ? error : 'The AI is unavailable.'} The built-in commands were used instead.` };
    throw new Error(typeof error === 'string' ? error : 'The AI could not handle that request.');
  }
  const plan = body as AiPlan;
  return { reply: plan.reply ?? '', actions: Array.isArray(plan.actions) ? plan.actions : [], provider: plan.provider ?? status.provider };
}

/** Checks every proposed action against the project's real statuses, people and cards; drops what does not fit. */
export function resolveActions(actions: AiAction[], data: ProjectData, me: Member): { resolved: ResolvedAction[]; skipped: string[] } {
  const resolved: ResolvedAction[] = [];
  const skipped: string[] = [];
  const firstOpen = data.statuses.find((s) => !s.isDone) ?? data.statuses[0];
  const validDay = (day: string | null | undefined) => (day === null ? null : day && parseDay(day) ? day : undefined);
  const priority = (p: unknown): Priority | undefined => ((PRIORITIES as readonly unknown[]).includes(p) ? (p as Priority) : undefined);

  actions.forEach((action, index) => {
    const key = `${index}-${action.type}`;
    const assignee = action.assignee === null ? null : action.assignee ? findMember(action.assignee, data.members, me) : undefined;
    if (action.assignee && !assignee) skipped.push(`Nobody called "${action.assignee}" can be assigned in this project.`);

    if (action.type === 'create_task') {
      const title = (action.title ?? '').trim().slice(0, 200);
      if (!title || !firstOpen) return;
      resolved.push({
        kind: 'create',
        key,
        title,
        description: (action.description ?? '').slice(0, 10000),
        status: findStatus(action.status, data.statuses) ?? firstOpen,
        priority: priority(action.priority) ?? 'medium',
        assignee: assignee ?? null,
        dueDate: validDay(action.due_date) ?? null,
      });
      return;
    }

    const task = findTask(action.task_id, data.tasks);
    if (!task) {
      skipped.push(`Could not find the card "${action.task_id ?? ''}".`);
      return;
    }
    const changes: TaskChanges = {};
    const status = findStatus(action.status, data.statuses);
    if (status && status.id !== task.statusId) changes.status = status;
    const p = priority(action.priority);
    if (p && p !== task.priority) changes.priority = p;
    if (assignee !== undefined && (assignee?.id ?? null) !== task.assigneeId) changes.assignee = assignee;
    const due = validDay(action.due_date);
    if (due !== undefined && due !== task.dueDate) changes.dueDate = due;
    if (Object.keys(changes).length) resolved.push({ kind: 'update', key, task, changes });
    else skipped.push(`"${task.title}" is already like that.`);
  });

  return { resolved, skipped: [...new Set(skipped)] };
}

export interface ApplyResult {
  created: number;
  updated: number;
  failed: string[];
}

/** Carries out the approved actions with the signed-in person's own permissions. */
export async function applyActions(projectId: string, actions: ResolvedAction[]): Promise<ApplyResult> {
  const result: ApplyResult = { created: 0, updated: 0, failed: [] };
  for (const action of actions) {
    try {
      if (action.kind === 'create') {
        await createTask(projectId, {
          title: action.title,
          description: action.description,
          statusId: action.status.id,
          priority: action.priority,
          assigneeId: action.assignee?.id ?? null,
          dueDate: action.dueDate,
        });
        result.created += 1;
      } else {
        const patch: TaskPatch = {};
        if (action.changes.status) patch.statusId = action.changes.status.id;
        if (action.changes.priority) patch.priority = action.changes.priority;
        if (action.changes.assignee !== undefined) patch.assigneeId = action.changes.assignee?.id ?? null;
        if (action.changes.dueDate !== undefined) patch.dueDate = action.changes.dueDate;
        await updateTask(action.task.id, patch);
        result.updated += 1;
      }
    } catch (error) {
      const label = action.kind === 'create' ? action.title : action.task.title;
      result.failed.push(`${label}: ${error instanceof Error ? error.message : 'failed'}`);
    }
  }
  return result;
}

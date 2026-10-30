import type { Member, Priority, Status, Task } from '@/lib/db/types';

/** One action as proposed by the AI (or the built-in parser). Ids may also be names; they are resolved before use. */
export interface AiAction {
  type: 'create_task' | 'update_task';
  task_id?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: Priority;
  /** Member id or name; null unassigns. */
  assignee?: string | null;
  /** YYYY-MM-DD; null clears the date. */
  due_date?: string | null;
}

export interface AiPlan {
  reply: string;
  actions: AiAction[];
  /** Which AI answered, e.g. "Gemini"; null for the built-in parser. */
  provider: string | null;
}

export interface TaskChanges {
  status?: Status;
  priority?: Priority;
  assignee?: Member | null;
  dueDate?: string | null;
}

/** An action checked against the project's real data, ready to show and apply. */
export type ResolvedAction =
  | {
      kind: 'create';
      key: string;
      title: string;
      description: string;
      status: Status;
      priority: Priority;
      assignee: Member | null;
      dueDate: string | null;
    }
  | { kind: 'update'; key: string; task: Task; changes: TaskChanges };

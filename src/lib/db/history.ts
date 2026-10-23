import { table } from '@/lib/db/tables';
import type { TaskHistoryEntry } from '@/lib/db/types';

export const listTaskHistory = async (taskId: string): Promise<TaskHistoryEntry[]> =>
  (await table('taskHistory').list({ taskId })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

import { table } from '@/lib/db/tables';
import type { ChecklistItem } from '@/lib/db/types';

function cleanText(text: string): string {
  const value = text.trim();
  if (!value) throw new Error('Checklist items need some text.');
  return value.slice(0, 300);
}

export async function listChecklistItems(taskId?: string | string[]): Promise<ChecklistItem[]> {
  const items = await table('checklistItems').list(taskId ? { taskId } : undefined);
  return items.sort((a, b) => a.order - b.order);
}

export async function addChecklistItem(taskId: string, text: string): Promise<ChecklistItem> {
  const siblings = await table('checklistItems').list({ taskId });
  const order = Math.max(-1, ...siblings.map((i) => i.order)) + 1;
  return table('checklistItems').insert({ taskId, text: cleanText(text), done: false, order });
}

export const updateChecklistItem = (
  id: string,
  patch: Partial<Pick<ChecklistItem, 'text' | 'done'>>,
): Promise<ChecklistItem> =>
  table('checklistItems').update(id, {
    ...patch,
    ...(patch.text !== undefined ? { text: cleanText(patch.text) } : {}),
  });

export async function deleteChecklistItem(id: string): Promise<void> {
  await table('checklistItems').remove({ id });
}

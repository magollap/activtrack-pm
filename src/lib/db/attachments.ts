import { backend } from '@/lib/backend';
import { table } from '@/lib/db/tables';
import { isMissingTable } from '@/lib/db/fields';
import type { Attachment, Task } from '@/lib/db/types';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
const UPDATE_NEEDED = 'File attachments need a one-time database update. Run supabase/migrations/20261031120000_automations_status_time_files.sql in the Supabase SQL Editor.';

export async function listAttachments(taskIds?: string | string[]): Promise<Attachment[]> {
  if (Array.isArray(taskIds) && !taskIds.length) return [];
  try {
    const rows = await table('attachments').list(taskIds ? { taskId: taskIds } : undefined);
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

const safeName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(-120) || 'file';

/** Uploads the file into the card's own folder, then records it. A failed record removes the uploaded file. */
export async function uploadAttachment(task: Pick<Task, 'id' | 'projectId'>, file: File): Promise<Attachment> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`"${file.name}" is larger than 25 MB.`);
  if (file.size === 0) throw new Error(`"${file.name}" is empty.`);
  const random = crypto.getRandomValues(new Uint32Array(2)).join('');
  const path = `${task.projectId}/${task.id}/${random}-${safeName(file.name)}`;
  await backend().uploadFile(path, file);
  try {
    return await table('attachments').insert({ taskId: task.id, name: file.name.slice(0, 255), size: file.size, mimeType: (file.type || 'application/octet-stream').slice(0, 150), path });
  } catch (error) {
    await backend().deleteFile(path).catch(() => undefined);
    if (isMissingTable(error)) throw new Error(UPDATE_NEEDED);
    throw error;
  }
}

export async function openAttachment(attachment: Attachment, download = false): Promise<void> {
  // Open the tab first (inside the click), then point it at the signed address, so pop-up blockers allow it.
  const tab = download ? null : window.open('', '_blank');
  if (tab) tab.opener = null;
  try {
    const url = await backend().fileUrl(attachment.path, download ? attachment.name : undefined);
    if (tab) tab.location.href = url;
    else if (download) {
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else window.location.assign(url);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

export async function deleteAttachment(attachment: Attachment): Promise<void> {
  const removed = await table('attachments').remove({ id: attachment.id });
  if (!removed) throw new Error('Only the person who added a file, or a project manager, can delete it.');
  await backend().deleteFile(attachment.path).catch(() => undefined);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const isImage = (a: Attachment) => /^image\/(png|jpe?g|gif|webp)$/i.test(a.mimeType);

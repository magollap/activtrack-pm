import { byCreated, table } from '@/lib/db/tables';
import type { Comment } from '@/lib/db/types';

function cleanBody(body: string): string {
  const value = body.trim();
  if (!value) throw new Error('Comments cannot be empty.');
  if (value.length > 5000) throw new Error('Comments can be at most 5000 characters.');
  return value;
}

export const listComments = async (taskId: string): Promise<Comment[]> =>
  (await table('comments').list({ taskId })).sort(byCreated);

/** The author is always the signed-in person; the server fills it in. */
export const createComment = (taskId: string, body: string): Promise<Comment> =>
  table('comments').insert({ taskId, body: cleanBody(body) });

export const updateComment = (id: string, body: string): Promise<Comment> =>
  table('comments').update(id, { body: cleanBody(body) });

export async function deleteComment(id: string): Promise<void> {
  const removed = await table('comments').remove({ id });
  if (!removed) throw new Error('You can only delete your own comments.');
}

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/useToast';
import { deleteComment, updateComment } from '@/lib/db/comments';
import { timeAgo } from '@/lib/dates';
import type { Comment, Member } from '@/lib/db/types';

interface CommentItemProps {
  comment: Comment;
  author: Member | undefined;
  canEdit: boolean;
  canDelete: boolean;
}

export function CommentItem({ comment, author, canEdit, canDelete }: CommentItemProps) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [confirming, setConfirming] = useState(false);
  const edited = comment.updatedAt !== comment.createdAt;

  const save = async () => {
    try {
      await updateComment(comment.id, draft);
      setEditing(false);
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <li className="group flex gap-3">
      <Avatar member={author} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{author?.name ?? 'Former member'}</span>
          <span className="text-xs text-slate-400">{timeAgo(comment.createdAt)}{edited && ' · edited'}</span>
          {!editing && (canEdit || canDelete) && (
            <div className="ml-auto flex gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              {canEdit && (
                <button className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" onClick={() => { setDraft(comment.body); setEditing(true); }} aria-label="Edit comment">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {canDelete && (
                <button className="rounded p-1 text-slate-400 hover:text-red-600" onClick={() => setConfirming(true)} aria-label="Delete comment">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
        {editing ? (
          <div className="mt-1 space-y-2">
            <textarea className="input min-h-[64px]" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={5000} autoFocus aria-label="Edit comment" />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost py-1.5" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn-primary py-1.5" onClick={save} disabled={!draft.trim()}>Save</button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-300">{comment.body}</p>
        )}
      </div>
      {confirming && (
        <ConfirmDialog
          title="Delete comment?"
          message="This comment will be permanently removed."
          confirmLabel="Delete"
          onConfirm={() => deleteComment(comment.id)}
          onClose={() => setConfirming(false)}
        />
      )}
    </li>
  );
}

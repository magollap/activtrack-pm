import { useState } from 'react';
import { Send } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { CommentItem } from '@/features/comments/CommentItem';
import { useCurrentUser } from '@/features/auth/AuthProvider';
import { useQuery } from '@/hooks/useQuery';
import { useToast } from '@/hooks/useToast';
import { createComment, listComments } from '@/lib/db/comments';
import type { Member } from '@/lib/db/types';

interface CommentsTabProps {
  taskId: string;
  members: Member[];
  editable: boolean;
  manage: boolean;
}

export function CommentsTab({ taskId, members, editable, manage }: CommentsTabProps) {
  const toast = useToast();
  const me = useCurrentUser();
  const { data: comments = [] } = useQuery(() => listComments(taskId), `comments:${taskId}`);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    try {
      await createComment(taskId, body);
      setBody('');
    } catch (error) {
      toast.error(error);
    } finally {
      setPosting(false);
    }
  };

  const authorOf = (id: string | null) => (id === me.id ? me : members.find((m) => m.id === id));

  return (
    <div className="space-y-5">
      {comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          {editable ? 'No comments yet. Start the conversation below.' : 'No comments yet.'}
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              author={authorOf(c.authorId)}
              canEdit={c.authorId === me.id}
              canDelete={c.authorId === me.id || manage}
            />
          ))}
        </ul>
      )}

      {editable ? (
        <form onSubmit={submit} className="card space-y-3 p-3">
          <div className="flex items-center gap-2">
            <Avatar member={me} size="xs" />
            <span className="text-xs text-slate-500">Commenting as <span className="font-medium text-slate-700 dark:text-slate-200">{me.name}</span></span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && e.currentTarget.form?.requestSubmit()}
            placeholder="Write a comment..."
            maxLength={5000}
            className="input min-h-[72px] resize-y"
            aria-label="Comment"
          />
          <div className="flex items-center justify-between">
            <span className="hidden text-xs text-slate-400 sm:inline">Ctrl + Enter to post</span>
            <button className="btn-primary ml-auto" disabled={!body.trim() || posting}><Send className="h-4 w-4" /> Post</button>
          </div>
        </form>
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-500 dark:bg-slate-800/60">You have view-only access to this project.</p>
      )}
    </div>
  );
}

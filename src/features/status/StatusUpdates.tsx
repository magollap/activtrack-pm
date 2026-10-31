import { useState } from 'react';
import { Activity, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Modal } from '@/components/Modal';
import { useCurrentUser } from '@/features/auth/AuthProvider';
import { useQuery } from '@/hooks/useQuery';
import { useToast } from '@/hooks/useToast';
import { timeAgo } from '@/lib/dates';
import { deleteStatusUpdate, draftStatusUpdate, editStatusUpdate, HEALTH_META, listStatusUpdates, postStatusUpdate, type StatusUpdateInput } from '@/lib/db/statusUpdates';
import { HEALTH_VALUES, type Health, type Member, type Status, type StatusUpdate, type Task } from '@/lib/db/types';
import { HelpLink } from '@/features/help/HelpLink';

export function HealthBadge({ health, size = 'sm' }: { health: Health; size?: 'sm' | 'md' }) {
  const meta = HEALTH_META[health];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${meta.className} ${size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

interface StatusPanelProps {
  projectId: string;
  tasks: Task[];
  statuses: Status[];
  members: Member[];
  canPost: boolean;
  onClose: () => void;
}

/** Every status update for a project, newest first, with a composer that drafts the summary from the cards. */
export function StatusUpdatesModal({ projectId, tasks, statuses, members, canPost, onClose }: StatusPanelProps) {
  const toast = useToast();
  const me = useCurrentUser();
  const { data: updates = [], loading } = useQuery(() => listStatusUpdates(projectId), `status-updates:${projectId}`);
  const [draft, setDraft] = useState<(StatusUpdateInput & { id?: string }) | null>(null);
  const [deleting, setDeleting] = useState<StatusUpdate | null>(null);
  const [busy, setBusy] = useState(false);
  const author = (id: string | null) => (id === me.id ? me : members.find((m) => m.id === id));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    try {
      if (draft.id) await editStatusUpdate(draft.id, draft);
      else await postStatusUpdate(projectId, draft);
      toast.success(draft.id ? 'Update saved' : 'Status update posted');
      setDraft(null);
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Status updates" onClose={onClose} size="lg" footer={<HelpLink section="status-updates" />}>
      <div className="space-y-5">
        {canPost && !draft && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setDraft(draftStatusUpdate(tasks, statuses))}>
              <Sparkles className="h-4 w-4" /> Write this week's update
            </button>
            <button className="btn-secondary" onClick={() => setDraft({ health: updates[0]?.health ?? 'on_track', title: '', body: '' })}>Start blank</button>
          </div>
        )}

        {draft && (
          <form onSubmit={save} className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-500/30 dark:bg-brand-500/5">
            {!draft.id && <p className="text-xs text-slate-500 dark:text-slate-400">Drafted from the project's cards. Edit anything before posting.</p>}
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Project health">
              {HEALTH_VALUES.map((h) => (
                <button
                  key={h}
                  type="button"
                  role="radio"
                  aria-checked={draft.health === h}
                  onClick={() => setDraft({ ...draft, health: h })}
                  className={`rounded-full ring-offset-2 transition-shadow dark:ring-offset-slate-900 ${draft.health === h ? 'ring-2 ring-slate-400' : 'opacity-60 hover:opacity-100'}`}
                >
                  <HealthBadge health={h} size="md" />
                </button>
              ))}
            </div>
            <div>
              <label className="label" htmlFor="status-title">Title</label>
              <input id="status-title" className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={120} />
            </div>
            <div>
              <label className="label" htmlFor="status-body">Update</label>
              <textarea id="status-body" className="input min-h-[200px] resize-y font-mono text-[13px] leading-relaxed" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} maxLength={10000} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy || !draft.title.trim()}>{draft.id ? 'Save' : 'Post update'}</button>
            </div>
          </form>
        )}

        {!loading && updates.length === 0 && !draft && (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
            <Activity className="mx-auto h-6 w-6 text-brand-600 dark:text-brand-400" />
            <p className="mt-2 text-sm font-medium">No status updates yet</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {canPost ? 'Post a weekly On track / At risk / Off track update so everyone knows where the project stands.' : 'Project leads post updates here.'}
            </p>
          </div>
        )}

        <ol className="space-y-4">
          {updates.map((u) => (
            <li key={u.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <HealthBadge health={u.health} />
                <h4 className="min-w-0 flex-1 truncate text-sm font-semibold">{u.title}</h4>
                {canPost && u.authorId === me.id && (
                  <button className="icon-btn h-8 w-8" onClick={() => setDraft({ id: u.id, health: u.health, title: u.title, body: u.body })} aria-label="Edit update"><Pencil className="h-4 w-4" /></button>
                )}
                {canPost && <button className="icon-btn h-8 w-8 hover:text-red-600" onClick={() => setDeleting(u)} aria-label="Delete update"><Trash2 className="h-4 w-4" /></button>}
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Avatar member={author(u.authorId)} size="xs" /> {author(u.authorId)?.name ?? 'Former member'} · {timeAgo(u.createdAt)}
              </p>
              {u.body && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">{u.body}</p>}
            </li>
          ))}
        </ol>
      </div>

      {deleting && (
        <ConfirmDialog
          title="Delete status update?"
          message={`"${deleting.title}" will be removed from the project's history.`}
          confirmLabel="Delete"
          onConfirm={async () => { await deleteStatusUpdate(deleting.id); toast.success('Update deleted'); }}
          onClose={() => setDeleting(null)}
        />
      )}
    </Modal>
  );
}

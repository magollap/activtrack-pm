import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUp, CornerDownLeft, Loader2, Sparkles, X, Zap } from 'lucide-react';
import { ActionPreview } from '@/features/ai/ActionPreview';
import { useCurrentUser } from '@/features/auth/AuthProvider';
import { loadProjectData } from '@/hooks/useProjectData';
import { useQuery } from '@/hooks/useQuery';
import { useToast } from '@/hooks/useToast';
import { aiStatus, applyActions, planRequest, resolveActions, type AiStatus } from '@/lib/ai/assistant';
import type { ResolvedAction } from '@/lib/ai/types';
import { MOD_KEY, onCommand } from '@/lib/commands';
import { canWrite, projectAccess } from '@/lib/db/access';
import { listMyMemberships } from '@/lib/db/projectMembers';
import { listProjects } from '@/lib/db/projects';
import { errorMessage } from '@/lib/errors';
import type { Member } from '@/lib/db/types';

type Phase = 'idle' | 'thinking' | 'review' | 'applying';

async function loadWritableProjects(me: Member) {
  const [projects, memberships] = await Promise.all([listProjects(), listMyMemberships(me.id)]);
  return projects.filter((p) => !p.archivedAt && canWrite(projectAccess(p, me, memberships)));
}

/** Global AI assistant: plain-English commands that add cards and change their status, priority, owner or due date. */
export function AssistantDialog() {
  const [open, setOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState('');

  useEffect(() => {
    const off = onCommand('assistant', (prompt) => {
      setInitialPrompt(prompt ?? '');
      setOpen(true);
    });
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setInitialPrompt('');
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      off();
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!open) return null;
  return <AssistantPanel initialPrompt={initialPrompt} onClose={() => setOpen(false)} />;
}

function AssistantPanel({ initialPrompt, onClose }: { initialPrompt: string; onClose: () => void }) {
  const me = useCurrentUser();
  const toast = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const routeProjectId = matchPath('/projects/:projectId', pathname)?.params.projectId ?? null;
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: projects = [] } = useQuery(() => loadWritableProjects(me), `ai-projects:${me.id}:${me.role}`);
  const [chosenId, setChosenId] = useState<string | null>(routeProjectId);
  const projectId = chosenId ?? projects.find((p) => !p.isPersonal)?.id ?? projects[0]?.id ?? null;
  const { data, loading } = useQuery(
    () => (projectId ? loadProjectData(projectId, me) : Promise.resolve(null)),
    `ai-project:${projectId}:${me.id}`,
  );

  const [status, setStatus] = useState<AiStatus | null>(null);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [phase, setPhase] = useState<Phase>('idle');
  const [reply, setReply] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<ResolvedAction[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [asked, setAsked] = useState('');

  useEffect(() => {
    void aiStatus().then(setStatus);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && phase !== 'applying' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, phase]);

  const editable = data ? canWrite(data.access) && !data.project.archivedAt : false;

  const examples = useMemo(() => {
    if (!data) return [];
    const done = data.statuses.find((s) => s.isDone)?.name ?? 'Done';
    const sample = data.tasks.find((t) => !data.statuses.find((s) => s.id === t.statusId)?.isDone)?.title;
    return [
      'Add a card to fix the login bug, high priority, due Friday',
      sample ? `Move "${sample}" to ${done}` : `Add a card to write release notes in ${data.statuses[1]?.name ?? done}`,
      'Add these cards:\n- Design homepage\n- Set up CI\n- Write tests',
      sample ? `Assign "${sample}" to me and make it urgent` : 'Add a card to plan the team retro for next week, assign to me',
    ];
  }, [data]);

  const reset = () => {
    setPhase('idle');
    setActions([]);
    setSkipped([]);
    setReply('');
    setNote(null);
  };

  const submit = useCallback(async (text: string) => {
    if (!data || !text.trim() || phase === 'thinking' || phase === 'applying') return;
    setPhase('thinking');
    setAsked(text.trim());
    setError(null);
    setNote(null);
    try {
      const plan = await planRequest(text.trim(), data, me);
      const { resolved, skipped: dropped } = resolveActions(plan.actions, data, me);
      setActions(resolved);
      setSelected(new Set(resolved.map((a) => a.key)));
      setSkipped(dropped);
      setReply(plan.reply || (resolved.length ? 'Here is what I will do.' : 'I could not find anything to change.'));
      setNote(plan.note ?? null);
      setPhase('review');
    } catch (e) {
      setError(errorMessage(e));
      setPhase('idle');
    }
  }, [data, me, phase]);

  const apply = async () => {
    if (!data) return;
    const chosen = actions.filter((a) => selected.has(a.key));
    if (!chosen.length) return;
    setPhase('applying');
    const result = await applyActions(data.project.id, chosen);
    const parts = [
      result.created && `added ${result.created} card${result.created === 1 ? '' : 's'}`,
      result.updated && `updated ${result.updated} card${result.updated === 1 ? '' : 's'}`,
    ].filter(Boolean);
    if (parts.length) toast.success(`AI ${parts.join(' and ')}`);
    if (result.failed.length) {
      toast.error(new Error(result.failed[0]));
      setPhase('review');
      return;
    }
    if (routeProjectId !== data.project.id) navigate(`/projects/${data.project.id}`);
    onClose();
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Pressing Enter again on the same request approves the preview.
      if (phase === 'review' && prompt.trim() === asked) void apply();
      else void submit(prompt);
    }
  };

  const chosenCount = actions.filter((a) => selected.has(a.key)).length;
  const providerLabel = status === null ? '' : status.enabled ? `${status.provider ?? 'AI'} AI` : 'Built-in commands';

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-start sm:px-4 sm:pt-[10vh]" role="dialog" aria-modal="true" aria-label="AI assistant">
      <div className="absolute inset-0 animate-fade-in bg-slate-950/50 backdrop-blur-sm" onClick={() => phase !== 'applying' && onClose()} />
      <div className="relative flex max-h-[90vh] w-full animate-scale-in flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-gold-500/20 dark:bg-slate-900 sm:max-w-2xl sm:rounded-2xl">
        <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-100 text-gold-700 dark:bg-gold-500/15 dark:text-gold-400">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">AI assistant</h2>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {providerLabel && <span className="mr-1 inline-flex items-center gap-1"><Zap className="h-3 w-3" />{providerLabel} ·</span>}
              Add cards and change their status in plain English
            </p>
          </div>
          {projects.length > 0 && (
            <select
              aria-label="Project"
              className="input w-auto max-w-[11rem] py-1.5 text-xs"
              value={projectId ?? ''}
              onChange={(e) => { setChosenId(e.target.value); reset(); }}
              disabled={phase === 'thinking' || phase === 'applying'}
            >
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <button className="icon-btn -mr-1" onClick={onClose} aria-label="Close assistant"><X className="h-4 w-4" /></button>
        </header>

        <div className="border-b border-slate-100 p-3 dark:border-slate-800">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={prompt}
              rows={prompt.includes('\n') ? Math.min(6, prompt.split('\n').length) : 2}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={onInputKey}
              disabled={!editable || phase === 'applying'}
              maxLength={2000}
              placeholder={
                !projects.length && !loading
                  ? 'You need write access to a project to use the assistant.'
                  : data && !editable
                    ? 'You have view-only access to this project.'
                    : 'e.g. Add a card to update the pricing page, high priority, due Friday, assign to me'
              }
              className="input resize-none py-3 pr-12 text-[15px] leading-relaxed"
              aria-label="What would you like to do?"
            />
            <button
              type="button"
              onClick={() => void submit(prompt)}
              disabled={!prompt.trim() || !editable || phase === 'thinking' || phase === 'applying'}
              className="absolute bottom-2.5 right-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-brand-contrast transition-colors hover:bg-brand-700 disabled:opacity-40 dark:bg-brand-500 dark:hover:bg-brand-400"
              aria-label="Ask"
            >
              {phase === 'thinking' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 flex items-center gap-1 px-1 text-[11px] text-slate-400">
            <CornerDownLeft className="h-3 w-3" />
            {phase === 'review' ? 'Enter again to apply · edit the text to ask something else' : `Enter to ask · Shift+Enter for a new line · ${MOD_KEY}+K to open anywhere`}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

          {phase === 'idle' && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">Try</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    disabled={!editable}
                    onClick={() => { setPrompt(example); inputRef.current?.focus(); }}
                    className="whitespace-pre-line rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm text-slate-600 transition-colors hover:border-gold-300 hover:bg-gold-50 disabled:opacity-50 dark:border-slate-800 dark:text-slate-300 dark:hover:border-gold-500/40 dark:hover:bg-gold-500/5"
                  >
                    {example}
                  </button>
                ))}
              </div>
              {status && !status.enabled && (
                <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Running on built-in commands: "add …", "move … to …", "mark … as done", "assign … to …", "make … urgent".
                  Add an AI key on the server (see DEPLOY.md) for free-form requests like "move everything overdue to Review".
                </p>
              )}
            </div>
          )}

          {phase === 'thinking' && (
            <div className="flex items-center gap-3 py-6 text-sm text-slate-500 dark:text-slate-400" role="status">
              <Loader2 className="h-4 w-4 animate-spin text-gold-600 dark:text-gold-400" /> Working out the changes…
            </div>
          )}

          {(phase === 'review' || phase === 'applying') && data && (
            <div className="space-y-3 animate-fade-in">
              <p className="text-sm text-slate-700 dark:text-slate-200">{reply}</p>
              {note && <p className="text-xs text-amber-700 dark:text-amber-300">{note}</p>}
              {actions.length > 0 && (
                <ul className="space-y-2">
                  {actions.map((action) => (
                    <ActionPreview
                      key={action.key}
                      action={action}
                      statuses={data.statuses}
                      members={data.members}
                      checked={selected.has(action.key)}
                      onToggle={() => setSelected((set) => {
                        const next = new Set(set);
                        if (next.has(action.key)) next.delete(action.key);
                        else next.add(action.key);
                        return next;
                      })}
                    />
                  ))}
                </ul>
              )}
              {skipped.length > 0 && (
                <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  {skipped.map((s) => <li key={s}>· {s}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        {(phase === 'review' || phase === 'applying') && (
          <footer className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            <button className="btn-ghost" onClick={() => { reset(); inputRef.current?.focus(); }} disabled={phase === 'applying'}>Start over</button>
            <button className="btn-primary" onClick={apply} disabled={!chosenCount || phase === 'applying'}>
              {phase === 'applying' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {chosenCount ? `Apply ${chosenCount} change${chosenCount === 1 ? '' : 's'}` : 'Nothing selected'}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

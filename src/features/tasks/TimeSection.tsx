import { useEffect, useState } from 'react';
import { Play, Plus, Square, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Avatar } from '@/components/Avatar';
import { useCurrentUser } from '@/features/auth/AuthProvider';
import { useQuery } from '@/hooks/useQuery';
import { useToast } from '@/hooks/useToast';
import { todayString } from '@/lib/dates';
import { deleteTimeEntry, entryMinutes, formatMinutes, listTimeEntries, logTime, parseDuration, startTimer, stopTimer } from '@/lib/db/time';
import type { Member, Task } from '@/lib/db/types';

/** Start/stop timer and manual time logs for one card. */
export function TimeSection({ task, members, editable, manage }: { task: Task; members: Member[]; editable: boolean; manage: boolean }) {
  const me = useCurrentUser();
  const toast = useToast();
  const { data: entries = [] } = useQuery(() => listTimeEntries(task.id), `time:${task.id}`);
  const [now, setNow] = useState(() => new Date());
  const [adding, setAdding] = useState(false);
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [day, setDay] = useState(todayString());
  const [busy, setBusy] = useState(false);

  const mine = entries.find((e) => !e.endedAt && e.userId === me.id);
  useEffect(() => {
    if (!mine) return;
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, [mine]);

  const total = entries.reduce((sum, e) => sum + entryMinutes(e, now), 0);
  const person = (id: string | null) => (id === me.id ? me : members.find((m) => m.id === id));

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await action();
      if (success) toast.success(success);
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = parseDuration(duration);
    if (!minutes) {
      toast.error(new Error('Enter the time spent, like 1h 30m, 45m or 1:15.'));
      return;
    }
    await run(async () => {
      await logTime(task.id, minutes, note, day);
      setDuration('');
      setNote('');
      setAdding(false);
    }, `Logged ${formatMinutes(minutes)}`);
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Time <span className="ml-1 font-normal tabular-nums text-slate-500">{formatMinutes(total)}</span></h3>
        {editable && (
          <div className="flex gap-1.5">
            {mine ? (
              <button className="btn border border-red-200 bg-red-50 py-1 text-xs text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" disabled={busy} onClick={() => run(() => stopTimer(mine), 'Timer stopped')}>
                <Square className="h-3 w-3 fill-current" /> Stop · {formatMinutes(entryMinutes(mine, now))}
              </button>
            ) : (
              <button className="btn border border-brand-200 bg-brand-50 py-1 text-xs text-brand-800 hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300" disabled={busy} onClick={() => run(() => startTimer(task.id, me.id), 'Timer started')}>
                <Play className="h-3 w-3 fill-current" /> Start timer
              </button>
            )}
            <button className="btn-ghost py-1 text-xs" onClick={() => setAdding((a) => !a)}><Plus className="h-3.5 w-3.5" /> Log time</button>
          </div>
        )}
      </div>

      {adding && (
        <form onSubmit={submit} className="mb-3 grid grid-cols-[6rem_8.5rem_1fr_auto] gap-2 max-sm:grid-cols-2">
          <input className="input py-1.5" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="1h 30m" aria-label="Time spent" autoFocus />
          <input type="date" className="input py-1.5" value={day} max={todayString()} onChange={(e) => setDay(e.target.value || todayString())} aria-label="Day" />
          <input className="input py-1.5 max-sm:col-span-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you work on? (optional)" maxLength={500} aria-label="Note" />
          <button className="btn-primary py-1.5" disabled={busy || !duration.trim()}>Add</button>
        </form>
      )}

      {entries.length > 0 ? (
        <ul className="space-y-1">
          {entries.slice(0, 20).map((e) => {
            const who = person(e.userId);
            return (
              <li key={e.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <Avatar member={who} size="xs" />
                <span className="w-16 shrink-0 font-medium tabular-nums">{e.endedAt ? formatMinutes(e.minutes) : <span className="text-red-600 dark:text-red-400">running</span>}</span>
                <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{e.note || who?.name || 'Former member'}</span>
                <span className="shrink-0 text-xs text-slate-500">{format(new Date(e.startedAt), 'MMM d')}</span>
                {(e.userId === me.id || manage) && (
                  <button className="rounded p-1 text-slate-400 opacity-100 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100" onClick={() => run(() => deleteTimeEntry(e.id))} aria-label="Delete time entry">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        !adding && <p className="text-xs text-slate-500 dark:text-slate-400">No time logged yet.</p>
      )}
    </section>
  );
}

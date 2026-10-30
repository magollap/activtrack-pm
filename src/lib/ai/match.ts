import type { Member, Status, Task } from '@/lib/db/types';

export const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[“”"'`’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const words = (text: string): string[] => normalize(text).split(' ').filter(Boolean);

const DONE_WORDS = new Set(['done', 'complete', 'completed', 'finished', 'finish', 'closed', 'close', 'resolved', 'shipped']);
const START_WORDS = new Set(['started', 'start', 'doing', 'in progress', 'progress', 'working', 'wip', 'active', 'ongoing']);

/** Finds a status by id, exact name, partial name, or meaning ("done", "started"). */
export function findStatus(text: string | undefined | null, statuses: Status[]): Status | null {
  if (!text) return null;
  const byId = statuses.find((s) => s.id === text);
  if (byId) return byId;
  const q = normalize(text);
  if (!q) return null;
  const exact = statuses.find((s) => normalize(s.name) === q);
  if (exact) return exact;
  const partial = statuses.find((s) => normalize(s.name).includes(q) || q.includes(normalize(s.name)));
  if (partial) return partial;
  if (DONE_WORDS.has(q)) return statuses.find((s) => s.isDone) ?? null;
  if (START_WORDS.has(q)) return startedStatus(statuses);
  if (['todo', 'to do', 'backlog', 'new', 'open', 'not started'].includes(q)) return statuses.find((s) => !s.isDone) ?? null;
  return null;
}

/** The "in progress" column: the first open status after the first one. */
export function startedStatus(statuses: Status[]): Status | null {
  const open = statuses.filter((s) => !s.isDone);
  return open.find((s) => /progress|doing|active|work/i.test(s.name)) ?? open[1] ?? open[0] ?? null;
}

/** Finds a person by id, full name, first name, @handle, or "me". */
export function findMember(text: string | undefined | null, members: Member[], me: Member): Member | null {
  if (!text) return null;
  const byId = members.find((m) => m.id === text);
  if (byId) return byId;
  const q = normalize(text.replace(/^@/, ''));
  if (!q) return null;
  if (['me', 'myself', 'i', 'mine'].includes(q)) return members.find((m) => m.id === me.id) ?? me;
  return (
    members.find((m) => normalize(m.name) === q) ??
    members.find((m) => normalize(m.name).split(' ')[0] === q) ??
    members.find((m) => normalize(m.name).startsWith(q) && q.length >= 3) ??
    members.find((m) => normalize(m.email.split('@')[0] ?? '') === q) ??
    null
  );
}

/** Finds the card a phrase most likely refers to; null when nothing is a convincing match. */
export function findTask(text: string | undefined | null, tasks: Task[]): Task | null {
  if (!text) return null;
  const byId = tasks.find((t) => t.id === text);
  if (byId) return byId;
  const q = normalize(text.replace(/^(the|my|our)\s+/i, '').replace(/\s+(card|task|ticket|item)$/i, ''));
  if (!q) return null;
  const exact = tasks.find((t) => normalize(t.title) === q);
  if (exact) return exact;

  const qWords = new Set(words(q));
  let best: { task: Task; score: number } | null = null;
  for (const task of tasks) {
    const title = normalize(task.title);
    let score = 0;
    if (` ${title} `.includes(` ${q} `) || (q.length >= 4 && title.includes(q))) score = 0.9 + q.length / (title.length * 100);
    else if (q.includes(title) && title.length >= 4) score = 0.8;
    else {
      const tWords = new Set(words(title));
      const shared = [...qWords].filter((w) => tWords.has(w)).length;
      score = shared / Math.max(qWords.size, 1) * 0.75 + shared / Math.max(tWords.size, 1) * 0.15;
    }
    if (!best || score > best.score) best = { task, score };
  }
  return best && best.score >= 0.5 ? best.task : null;
}

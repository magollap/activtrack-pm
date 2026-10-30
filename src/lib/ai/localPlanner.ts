import { addDays, isSameWeek, nextDay, parse, isValid, type Day } from 'date-fns';
import { toDayString } from '@/lib/dates';
import { findMember, findStatus, findTask as findCard, normalize, startedStatus } from '@/lib/ai/match';
import type { AiAction, AiPlan } from '@/lib/ai/types';
import type { Member, Priority, Status, Task } from '@/lib/db/types';

/**
 * Built-in command parser used when no AI provider is configured (or it cannot be reached).
 * It understands the everyday commands, for example:
 *   add a card "Fix login bug" high priority due Friday assign to Priya
 *   create task Write release notes in Review
 *   move fix login bug to Done      mark release notes as done      start onboarding emails
 *   set fix login priority to urgent      assign release notes to Sam
 */

interface PlannerData {
  statuses: Status[];
  tasks: Task[];
  members: Member[];
  me: Member;
}

const WEEKDAYS: Record<string, Day> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};
const PRIORITY_WORDS: Record<string, Priority> = {
  low: 'low', medium: 'medium', normal: 'medium', high: 'high', important: 'high', urgent: 'urgent', asap: 'urgent', critical: 'urgent',
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Extracted<T> {
  value: T;
  rest: string;
}

function cutAt(text: string, index: number, length: number): string {
  return `${text.slice(0, index)} ${text.slice(index + length)}`.replace(/\s{2,}/g, ' ').trim();
}

const cut = (text: string, match: RegExpMatchArray): string => cutAt(text, match.index ?? 0, match[0].length);

/** Pulls a due date phrase out of the text. Weekday and month names need "due/by/on" in front, so titles stay intact. */
export function extractDue(text: string, today = new Date()): Extracted<string | null> | null {
  const rules: [RegExp, (m: RegExpMatchArray) => Date | null][] = [
    [/\b(?:due\s+|by\s+|for\s+)?(?:today|tonight|eod|end of day)\b/i, () => today],
    [/\b(?:due\s+|by\s+|for\s+)?tomorrow\b/i, () => addDays(today, 1)],
    [/\b(?:due\s+|by\s+|for\s+)?next week\b/i, () => nextDay(today, 1)],
    [/\b(?:due\s+|for\s+)?in (\d{1,3}) days?\b/i, (m) => addDays(today, Number(m[1]))],
    [/\b(?:due\s+|for\s+)?in (?:a|one) week\b/i, () => addDays(today, 7)],
    [/\b(?:due|by|on|before|until)\s+(\d{4}-\d{2}-\d{2})\b/i, (m) => parse(m[1], 'yyyy-MM-dd', today)],
    [/\b(?:due|by|on|before|until)\s+(?:the\s+)?(next\s+)?(sun|sunday|mon|monday|tues?|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday)\b/i, (m) => {
      const target = nextDay(today, WEEKDAYS[m[2].toLowerCase()]);
      return m[1] && isSameWeek(target, today, { weekStartsOn: 1 }) ? addDays(target, 7) : target;
    }],
    [/\b(?:due|by|on|before|until)\s+((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2})(?:st|nd|rd|th)?\b/i, (m) => monthDay(m[1].replace('.', ''), 'MMM d', today)],
    [/\b(?:due|by|on|before|until)\s+(\d{1,2})(?:st|nd|rd|th)?\s+((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*)\b/i, (m) => monthDay(`${m[2]} ${m[1]}`, 'MMM d', today)],
    [/\bno due date\b|\b(?:clear|remove) (?:the )?due date\b/i, () => null],
  ];
  for (const [pattern, toDate] of rules) {
    const match = text.match(pattern);
    if (!match) continue;
    const date = toDate(match);
    if (date !== null && !isValid(date)) continue;
    return { value: date ? toDayString(date) : null, rest: cut(text, match) };
  }
  return null;
}

function monthDay(text: string, format: string, today: Date): Date | null {
  const cleaned = text.replace(/^(\w{3})\w*/, '$1');
  let date = parse(cleaned, format, today);
  if (!isValid(date)) return null;
  if (date < addDays(today, -1)) date = parse(`${cleaned} ${today.getFullYear() + 1}`, `${format} yyyy`, today);
  return date;
}

export function extractPriority(text: string): Extracted<Priority> | null {
  const patterns = [
    /\b(?:with\s+)?(?:a\s+)?priority\s*(?:is|:|=|of|to)?\s*(low|medium|normal|high|urgent)\b/i,
    /\b(?:with\s+)?(?:a\s+)?(low|medium|normal|high|urgent)[\s-]*priority\b/i,
    /!(low|medium|high|urgent)\b/i,
    /\b(urgent|asap|critical)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return { value: PRIORITY_WORDS[match[1].toLowerCase()], rest: cut(text, match) };
  }
  return null;
}

export function extractAssignee(text: string, members: Member[], me: Member): Extracted<Member | null> | null {
  const unassign = text.match(/\b(?:unassign(?:ed)?|no (?:one|owner|assignee))\b/i);
  if (unassign) return { value: null, rest: cut(text, unassign) };
  const patterns = [
    /\b(?:and\s+)?assign(?:ed)?\s+(?:it\s+|this\s+)?to\s+(@?[\p{L}.'-]+(?:\s+[\p{L}.'-]+)?)/iu,
    /\b(?:owner|assignee)\s*[:=]?\s*(@?[\p{L}.'-]+(?:\s+[\p{L}.'-]+)?)/iu,
    /\bfor\s+(@?[\p{L}.'-]+(?:\s+[\p{L}.'-]+)?)/iu,
    /(@[\p{L}.'-]+)/u,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const [first, second] = match[1].split(/\s+/);
    const both = second ? findMember(`${first} ${second}`, members, me) : null;
    const member = both ?? findMember(first, members, me);
    if (!member) continue;
    // Only consume the second word when it was part of the name.
    const consumed = both ? match[0] : match[0].replace(new RegExp(`\\s+${escape(second ?? '')}$`), '');
    return { value: member, rest: cutAt(text, match.index ?? 0, consumed.length) };
  }
  return null;
}

function extractStatus(text: string, statuses: Status[]): Extracted<Status> | null {
  const names = [...statuses].sort((a, b) => b.name.length - a.name.length).map((s) => escape(s.name));
  if (!names.length) return null;
  const pattern = new RegExp(`\\b(?:to|in|into|under|on|as)\\s+(?:the\\s+)?["']?(${names.join('|')})["']?(?:\\s+(?:column|list|lane|status))?(?=\\s|$|[.,!])`, 'i');
  const match = text.match(pattern);
  if (!match) return null;
  const status = findStatus(match[1], statuses);
  return status ? { value: status, rest: cut(text, match) } : null;
}

const CREATE_ONLY = /^(?:please\s+)?(?:can you\s+|could you\s+)?(?:add|create|new|log)\b/i;
const CREATE = /^(?:please\s+)?(?:can you\s+|could you\s+)?(?:add|create|make|new|log|open|put)\b\s*(?:an?\s+|the\s+|another\s+)?(?:new\s+)?(?:cards?|tasks?|todos?|to-dos?|items?|tickets?|stor(?:y|ies)|bugs?)?\b\s*/i;
const TITLE_LEAD = /^(?:called|named|titled|about|to|for|:|-|–)\s*/i;

function cleanTitle(text: string): string {
  let title = text.replace(TITLE_LEAD, '').trim();
  const quoted = title.match(/^["“'](.+?)["”']/);
  if (quoted) title = quoted[1];
  return title
    .replace(/^["“']|["”']$/g, '')
    .replace(/[\s,;.]+$/, '')
    .replace(/\s+(?:and|with|for|by|on|due|to|in|at)$/i, '')
    .trim()
    .slice(0, 200);
}

function planCreate(body: string, data: PlannerData): AiAction | null {
  let rest = body;
  const action: AiAction = { type: 'create_task' };
  const due = extractDue(rest);
  if (due) ({ value: action.due_date, rest } = due);
  const priority = extractPriority(rest);
  if (priority) ({ value: action.priority, rest } = priority);
  const assignee = extractAssignee(rest, data.members, data.me);
  if (assignee) {
    action.assignee = assignee.value?.id ?? null;
    rest = assignee.rest;
  }
  const status = extractStatus(rest, data.statuses);
  if (status) {
    action.status = status.value.id;
    rest = status.rest;
  }
  const title = cleanTitle(rest);
  if (!title) return null;
  action.title = title.charAt(0).toUpperCase() + title.slice(1);
  return action;
}

const PRONOUN = /^(?:it|this|that|this card|that card|this one|that one)$/i;

function planUpdate(line: string, data: PlannerData, lastTaskId: string | null): AiAction | null {
  const { statuses, members, me } = data;
  // "it" / "this" refers to the card mentioned just before, as in "move login bug to Review; assign it to me".
  const findTask = (phrase: string) =>
    PRONOUN.test(phrase.trim()) ? data.tasks.find((t) => t.id === lastTaskId) ?? null : findCard(phrase, data.tasks);
  const done = statuses.find((s) => s.isDone);

  // "mark X as done", "move X to Review", "X is done"
  const move = line.match(/^(?:please\s+)?(?:mark|set|flag)\s+(.+?)\s+(done|complete|completed|finished|in progress|started|blocked)[.!]?$/i)
    ?? line.match(/^(?:please\s+)?(?:move|mark|set|change|put|send|shift|drag|update)\s+(.+?)\s+(?:to|as|into|in|->|→)\s+(?:the\s+)?(.+?)(?:\s+(?:column|status|list|lane))?[.!]?$/i)
    ?? line.match(/^(.+?)\s+(?:is|are)\s+(?:now\s+)?(done|complete|completed|finished|in progress|started|blocked|in review)[.!]?$/i);
  if (move) {
    const target = move[2];
    const task = findTask(move[1].replace(/\s+(?:priority|status)$/i, ''));
    const priority = extractPriority(target);
    const status = findStatus(target, statuses);
    const assignee = /^assign/i.test(line) ? findMember(target, members, me) : null;
    if (task && status && !priority) return { type: 'update_task', task_id: task.id, status: status.id };
    if (task && priority) return { type: 'update_task', task_id: task.id, priority: priority.value };
    if (task && PRIORITY_WORDS[normalize(target)]) return { type: 'update_task', task_id: task.id, priority: PRIORITY_WORDS[normalize(target)] };
    if (task && assignee) return { type: 'update_task', task_id: task.id, assignee: assignee.id };
    const due = task ? extractDue(`due ${target}`) : null;
    if (task && due) return { type: 'update_task', task_id: task.id, due_date: due.value };
  }

  // "complete X", "finish X", "close X", "start X", "reopen X"
  const verb = line.match(/^(?:please\s+)?(complete|finish|close|resolve|done with|start|begin|start working on|reopen)\s+(.+?)[.!]?$/i);
  if (verb) {
    const task = findTask(verb[2]);
    const word = verb[1].toLowerCase();
    const status = word === 'reopen' ? statuses.find((s) => !s.isDone) : word.startsWith('start') || word === 'begin' ? startedStatus(statuses) : done;
    if (task && status) return { type: 'update_task', task_id: task.id, status: status.id };
  }

  // "assign X to Sam"
  const assign = line.match(/^(?:please\s+)?(?:assign|give|hand)\s+(.+?)\s+to\s+(.+?)[.!]?$/i);
  if (assign) {
    const task = findTask(assign[1]);
    const member = findMember(assign[2], members, me);
    if (task && member) return { type: 'update_task', task_id: task.id, assignee: member.id };
  }

  // "make X urgent", "X due friday"
  const priority = line.match(/^(?:please\s+)?(?:make|bump|raise|lower|set)\s+(.+?)\s+(?:to\s+)?(low|medium|normal|high|urgent)(?:\s+priority)?[.!]?$/i);
  if (priority) {
    const task = findTask(priority[1]);
    if (task) return { type: 'update_task', task_id: task.id, priority: PRIORITY_WORDS[priority[2].toLowerCase()] };
  }
  const due = extractDue(line);
  if (due) {
    const task = findTask(due.rest.replace(/^(?:set|make|move|change)\s+/i, '').replace(/\s+(?:to\s+be\s+)?due$/i, ''));
    if (task) return { type: 'update_task', task_id: task.id, due_date: due.value };
  }
  return null;
}

function splitCommands(prompt: string): { creates: string[]; lines: string[] } {
  const rawLines = prompt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // "add these cards:" followed by a bulleted list: each bullet becomes a card.
  if (rawLines.length > 1 && CREATE.test(rawLines[0]) && rawLines.slice(1).every((l) => /^([-*•]|\d+[.)])\s+/.test(l))) {
    const header = rawLines[0].replace(CREATE, '').replace(/^(?:these|the following|this list)\b.*$/i, '').trim();
    const creates = rawLines.slice(1).map((l) => `${l.replace(/^([-*•]|\d+[.)])\s+/, '')} ${header}`.trim());
    return { creates, lines: [] };
  }
  const lines = rawLines.flatMap((l) => l.split(/\s*;\s*|\s+(?:and\s+)?then\s+/i)).map((l) => l.replace(/^([-*•]|\d+[.)])\s+/, '')).filter(Boolean);
  return { creates: [], lines };
}

export function planLocally(prompt: string, data: PlannerData): AiPlan {
  const { creates, lines } = splitCommands(prompt);
  const actions: AiAction[] = [];
  const missed: string[] = [];

  for (const body of creates) {
    const action = planCreate(body, data);
    if (action) actions.push(action);
    else missed.push(body);
  }
  let lastTaskId: string | null = null;
  for (const line of lines) {
    // "add/create/new" always makes a card; other verbs ("make", "put") try to change a card first.
    const action: AiAction | null = CREATE_ONLY.test(line)
      ? planCreate(line.replace(CREATE, ''), data)
      : planUpdate(line, data, lastTaskId) ?? (CREATE.test(line) ? planCreate(line.replace(CREATE, ''), data) : null);
    if (action) {
      actions.push(action);
      if (action.task_id) lastTaskId = action.task_id;
    } else missed.push(line);
  }

  const creates_ = actions.filter((a) => a.type === 'create_task').length;
  const updates = actions.length - creates_;
  const parts = [creates_ && `add ${creates_} card${creates_ === 1 ? '' : 's'}`, updates && `update ${updates} card${updates === 1 ? '' : 's'}`].filter(Boolean);
  let reply = parts.length ? `I'll ${parts.join(' and ')}.` : '';
  if (missed.length) {
    reply += `${reply ? ' ' : ''}I couldn't work out "${missed[0].slice(0, 60)}". Try "add …" or "move … to ${data.statuses.find((s) => s.isDone)?.name ?? 'Done'}".`;
  }
  return { reply, actions, provider: null };
}

import { randomUUID } from 'node:crypto';
import { HttpError } from './auth.mjs';

const DEFAULT_STATUSES = [
  { name: 'To do', color: '#64748b', isDone: false },
  { name: 'In progress', color: '#2550e8', isDone: false },
  { name: 'Review', color: '#c9a227', isDone: false },
  { name: 'Done', color: '#0a8c4e', isDone: true },
];
const PALETTE = ['#0a8c4e', '#c9a227', '#2550e8', '#0284c7', '#0d9488', '#d97706', '#ea580c', '#e11d48', '#7c3aed'];

const str = (max, min = 0) => (v) => typeof v === 'string' && v.length >= min && v.length <= max;
const color = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const bool = (v) => typeof v === 'boolean';
const int = (v) => Number.isInteger(v) && Math.abs(v) < 1e9;
const id = (v) => typeof v === 'string' && v.length > 0 && v.length <= 64;
const day = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const iso = (v) => typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));
const oneOf = (...values) => (v) => values.includes(v);
const nullable = (check) => (v) => v === null || check(v);

export const ROLES = ['governor', 'delegate', 'reporter'];
const WRITERS = ['write', 'write_delete', 'lead', 'manage'];
const MANAGERS = ['lead', 'manage'];
const nowIso = () => new Date().toISOString();

/** Per-request view of the data with the signed-in user's access, matching the online database rules. */
export function createContext(store, me) {
  const db = store.data.collections;
  const isGovernor = me.role === 'governor' && !me.disabled;
  const canCreateProjects = (me.role === 'governor' || me.role === 'delegate') && !me.disabled;
  const accessCache = new Map();

  const project = (projectId) => db.projects.find((p) => p.id === projectId);
  const task = (taskId) => db.tasks.find((t) => t.id === taskId);

  function access(projectId) {
    if (accessCache.has(projectId)) return accessCache.get(projectId);
    const p = project(projectId);
    let result = null;
    if (p && !me.disabled) {
      if (p.isPersonal) result = p.ownerId === me.id ? 'manage' : null;
      else if (isGovernor) result = 'manage';
      else if (me.role === 'delegate' && p.createdBy === me.id) result = 'lead';
      else {
        const granted = db.projectMembers.find((m) => m.projectId === p.id && m.userId === me.id)?.access ?? null;
        result = granted && me.role === 'reporter' ? 'read' : granted;
      }
    }
    accessCache.set(projectId, result);
    return result;
  }

  const taskAccess = (taskId) => {
    const t = task(taskId);
    return t ? access(t.projectId) : null;
  };
  const canWriteTask = (taskId) => WRITERS.includes(taskAccess(taskId));

  let visibleProfiles = null;
  function canSeeProfile(targetId) {
    if (targetId === me.id || isGovernor) return true;
    if (!visibleProfiles) {
      visibleProfiles = new Set();
      const activeGovernors = db.profiles.filter((p) => p.role === 'governor' && !p.disabled).map((p) => p.id);
      for (const p of db.projects) {
        if (access(p.id) === null) continue;
        if (p.ownerId) visibleProfiles.add(p.ownerId);
        if (!p.isPersonal && p.createdBy) visibleProfiles.add(p.createdBy);
        db.projectMembers.filter((m) => m.projectId === p.id).forEach((m) => visibleProfiles.add(m.userId));
        if (!p.isPersonal) activeGovernors.forEach((a) => visibleProfiles.add(a));
      }
    }
    return visibleProfiles.has(targetId);
  }

  const statusInProject = (row) => db.statuses.some((s) => s.id === row.statusId && s.projectId === row.projectId);
  const profileExists = (userId) => userId === null || db.profiles.some((p) => p.id === userId);

  const RULES = {
    profiles: {
      fields: { name: str(80, 1), color },
      select: (row) => canSeeProfile(row.id),
      update: { columns: ['name', 'color'], allow: (row) => row.id === me.id },
    },
    projects: {
      fields: { name: str(80, 1), description: str(2000), color, archivedAt: nullable(iso) },
      select: (row) => access(row.id) !== null,
      insert: {
        columns: ['name', 'description', 'color'],
        defaults: () => ({ description: '', color: '#0a8c4e', archivedAt: null, isPersonal: false, ownerId: null, createdBy: me.id }),
        allow: () => canCreateProjects,
      },
      update: { columns: ['name', 'description', 'color', 'archivedAt'], allow: (row) => MANAGERS.includes(access(row.id)) },
      remove: (row) => !row.isPersonal && isGovernor,
    },
    projectMembers: {
      fields: { projectId: id, userId: id, access: oneOf('read', 'write', 'write_delete') },
      select: (row) => isGovernor || access(row.projectId) !== null,
      insert: {
        columns: ['projectId', 'userId', 'access'],
        defaults: () => ({ access: 'write' }),
        allow: (row) =>
          isGovernor &&
          project(row.projectId)?.isPersonal === false &&
          db.profiles.some((p) => p.id === row.userId) &&
          !db.projectMembers.some((m) => m.projectId === row.projectId && m.userId === row.userId),
      },
      update: { columns: ['access'], allow: () => isGovernor },
      remove: () => isGovernor,
    },
    statuses: {
      fields: { projectId: id, name: str(40, 1), color, order: int, isDone: bool },
      select: (row) => access(row.projectId) !== null,
      insert: {
        columns: ['projectId', 'name', 'color', 'order', 'isDone'],
        defaults: () => ({ color: '#64748b', order: 0, isDone: false }),
        allow: (row) => MANAGERS.includes(access(row.projectId)),
      },
      update: { columns: ['name', 'color', 'order', 'isDone'], allow: (row) => MANAGERS.includes(access(row.projectId)) },
      remove: (row) => MANAGERS.includes(access(row.projectId)),
    },
    tasks: {
      fields: {
        projectId: id,
        title: str(200, 1),
        description: str(10000),
        statusId: id,
        priority: oneOf('low', 'medium', 'high', 'urgent'),
        assigneeId: nullable(id),
        startDate: nullable(day),
        dueDate: nullable(day),
        order: int,
        completedAt: nullable(iso),
      },
      select: (row) => access(row.projectId) !== null,
      insert: {
        columns: ['projectId', 'title', 'description', 'statusId', 'priority', 'assigneeId', 'startDate', 'dueDate', 'order', 'completedAt'],
        defaults: () => ({ description: '', priority: 'medium', assigneeId: null, startDate: null, dueDate: null, order: 0, completedAt: null, createdBy: me.id }),
        allow: (row) => WRITERS.includes(access(row.projectId)) && statusInProject(row) && profileExists(row.assigneeId),
      },
      update: {
        columns: ['title', 'description', 'statusId', 'priority', 'assigneeId', 'startDate', 'dueDate', 'order', 'completedAt'],
        allow: (row, next) =>
          WRITERS.includes(access(row.projectId)) && statusInProject(next) && profileExists(next.assigneeId),
      },
      remove: (row) => {
        const level = access(row.projectId);
        return MANAGERS.includes(level) || (level === 'write_delete' && row.createdBy === me.id);
      },
    },
    checklistItems: {
      fields: { taskId: id, text: str(300, 1), done: bool, order: int },
      select: (row) => taskAccess(row.taskId) !== null,
      insert: {
        columns: ['taskId', 'text', 'done', 'order'],
        defaults: () => ({ done: false, order: 0 }),
        allow: (row) => canWriteTask(row.taskId),
      },
      update: { columns: ['text', 'done', 'order'], allow: (row) => canWriteTask(row.taskId) },
      remove: (row) => canWriteTask(row.taskId),
    },
    comments: {
      fields: { taskId: id, body: str(5000, 1) },
      select: (row) => taskAccess(row.taskId) !== null,
      insert: {
        columns: ['taskId', 'body'],
        defaults: () => ({ authorId: me.id }),
        allow: (row) => canWriteTask(row.taskId),
      },
      update: { columns: ['body'], allow: (row) => row.authorId === me.id && taskAccess(row.taskId) !== null },
      remove: (row) =>
        (row.authorId === me.id && taskAccess(row.taskId) !== null) || MANAGERS.includes(taskAccess(row.taskId)),
    },
    taskHistory: {
      fields: {},
      select: (row) => taskAccess(row.taskId) !== null,
    },
  };

  return { db, me, isGovernor, access, rules: RULES };
}

const denied = () => new HttpError(403, 'You do not have permission to do that.');

function validate(rules, row, keys) {
  for (const key of keys) {
    const check = rules.fields[key];
    if (check && !check(row[key])) throw new HttpError(400, `Some of the values you entered are not allowed (${key}).`);
  }
}

function pickColumns(input, columns) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new HttpError(400, 'Invalid data.');
  for (const key of Object.keys(input)) if (!columns.includes(key)) throw denied();
  return input;
}

export function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) =>
    Array.isArray(value) ? value.includes(row[key]) : (row[key] ?? null) === value,
  );
}

export function checkFilter(filter) {
  if (typeof filter !== 'object' || filter === null || Array.isArray(filter)) throw new HttpError(400, 'Invalid filter.');
  const ok = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v);
  for (const value of Object.values(filter)) {
    if (Array.isArray(value) ? !value.every(ok) : !ok(value)) throw new HttpError(400, 'Invalid filter.');
  }
  return filter;
}

function ruleFor(ctx, collection) {
  const rules = ctx.rules[collection];
  if (!rules) throw new HttpError(404, 'Unknown collection.');
  return rules;
}

export function listRows(ctx, collection, filter) {
  const rules = ruleFor(ctx, collection);
  return ctx.db[collection].filter((row) => matches(row, filter) && rules.select(row));
}

export function insertRows(ctx, collection, inputs) {
  const rules = ruleFor(ctx, collection);
  if (!rules.insert) throw denied();
  if (!Array.isArray(inputs) || inputs.length > 500) throw new HttpError(400, 'Invalid data.');
  const now = nowIso();
  const rows = inputs.map((input) => {
    const row = { ...rules.insert.defaults(), ...pickColumns(input, rules.insert.columns) };
    validate(rules, row, Object.keys(rules.fields));
    if (!rules.insert.allow(row)) throw denied();
    return { ...row, id: randomUUID(), createdAt: now, updatedAt: now };
  });
  ctx.db[collection].push(...rows);
  return rows;
}

const HISTORY_FIELDS = [
  ['title', 'title'],
  ['statusId', 'status'],
  ['priority', 'priority'],
  ['assigneeId', 'assignee'],
  ['dueDate', 'dueDate'],
];

function describe(db, field, value) {
  if (value === null || value === undefined) return null;
  if (field === 'statusId') return db.statuses.find((s) => s.id === value)?.name ?? null;
  if (field === 'priority') return value.charAt(0).toUpperCase() + value.slice(1);
  if (field === 'assigneeId') return db.profiles.find((p) => p.id === value)?.name ?? 'Former member';
  if (field === 'dueDate') {
    const date = new Date(`${value}T00:00:00Z`);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  return String(value);
}

function recordTaskHistory(ctx, before, after) {
  const now = nowIso();
  for (const [key, field] of HISTORY_FIELDS) {
    if ((before[key] ?? null) === (after[key] ?? null)) continue;
    ctx.db.taskHistory.push({
      id: randomUUID(),
      taskId: after.id,
      field,
      from: describe(ctx.db, key, before[key]),
      to: describe(ctx.db, key, after[key]),
      actorId: ctx.me.id,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export function updateRow(ctx, collection, rowId, patch) {
  const rules = ruleFor(ctx, collection);
  if (!rules.update) throw denied();
  const index = ctx.db[collection].findIndex((row) => row.id === rowId);
  const current = index === -1 ? null : ctx.db[collection][index];
  if (!current || !rules.select(current)) {
    throw new HttpError(404, 'This item no longer exists, or you do not have permission to change it.');
  }
  const changes = pickColumns(patch, rules.update.columns);
  const next = { ...current, ...changes, updatedAt: nowIso() };
  validate(rules, next, Object.keys(changes));
  if (!rules.update.allow(current, next)) throw denied();
  ctx.db[collection][index] = next;
  if (collection === 'tasks') recordTaskHistory(ctx, current, next);
  return next;
}

function cascade(db, collection, removed) {
  const ids = new Set(removed.map((r) => r.id));
  const drop = (name, key) => {
    const gone = db[name].filter((r) => ids.has(r[key]));
    db[name] = db[name].filter((r) => !ids.has(r[key]));
    return gone;
  };
  if (collection === 'projects') {
    drop('statuses', 'projectId');
    drop('projectMembers', 'projectId');
    cascade(db, 'tasks', drop('tasks', 'projectId'));
  }
  if (collection === 'tasks') {
    drop('checklistItems', 'taskId');
    drop('comments', 'taskId');
    drop('taskHistory', 'taskId');
  }
}

export function removeRows(ctx, collection, filter) {
  const rules = ruleFor(ctx, collection);
  if (!rules.remove) throw denied();
  const doomed = ctx.db[collection].filter((row) => matches(row, filter) && rules.select(row) && rules.remove(row));
  if (collection === 'statuses' && doomed.some((s) => ctx.db.tasks.some((t) => t.statusId === s.id))) {
    throw new HttpError(409, 'Move the tasks out of this status before deleting it.');
  }
  const ids = new Set(doomed.map((r) => r.id));
  ctx.db[collection] = ctx.db[collection].filter((row) => !ids.has(row.id));
  cascade(ctx.db, collection, doomed);
  return doomed.length;
}

/** A brand-new account gets a profile and a private "My space"; the very first account is the governor. */
export function createAccount(store, { name, email, authSource, role }) {
  const db = store.data.collections;
  const now = nowIso();
  const hasGovernor = db.profiles.some((p) => p.role === 'governor');
  const profile = {
    id: randomUUID(),
    name: name.slice(0, 80) || 'User',
    email,
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    role: hasGovernor ? role : 'governor',
    disabled: false,
    authSource,
    createdAt: now,
    updatedAt: now,
  };
  db.profiles.push(profile);
  const space = {
    id: randomUUID(),
    name: 'My space',
    description: 'Your private space. Only you can see it.',
    color: '#0a8c4e',
    archivedAt: null,
    isPersonal: true,
    ownerId: profile.id,
    createdBy: profile.id,
    createdAt: now,
    updatedAt: now,
  };
  db.projects.push(space);
  db.statuses.push(
    ...DEFAULT_STATUSES.map((s, order) => ({ ...s, id: randomUUID(), projectId: space.id, order, createdAt: now, updatedAt: now })),
  );
  return profile;
}

/** Same safeguards as the online database: governors only, and never zero active governors. */
export function changeUser(store, me, targetId, role, disabled) {
  if (me.role !== 'governor') throw new HttpError(403, 'Only governors can change accounts.');
  if (!ROLES.includes(role) || typeof disabled !== 'boolean') throw new HttpError(400, 'Unknown role.');
  const db = store.data.collections;
  const target = db.profiles.find((p) => p.id === targetId);
  if (!target) throw new HttpError(404, 'This account no longer exists.');
  if (targetId === me.id && (role !== 'governor' || disabled)) {
    throw new HttpError(400, 'You cannot remove your own governor role or disable your own account.');
  }
  if (!wouldKeepAGovernor(db, target, role, disabled)) throw new HttpError(400, 'ActivTrack needs at least one active governor.');
  Object.assign(target, { role, disabled, updatedAt: nowIso() });
  return target;
}

export function wouldKeepAGovernor(db, target, role, disabled) {
  const losing = target.role === 'governor' && !target.disabled && (role !== 'governor' || disabled);
  return !losing || db.profiles.some((p) => p.role === 'governor' && !p.disabled && p.id !== target.id);
}

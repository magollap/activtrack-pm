import { addDays } from 'date-fns';
import { table, byCreated } from '@/lib/db/tables';
import { isHexColor } from '@/lib/colors';
import { toDayString } from '@/lib/dates';
import { createField, isMissingTable, listFields } from '@/lib/db/fields';
import { createProject, DEFAULT_STATUSES, type ProjectInput } from '@/lib/db/projects';
import { createTask } from '@/lib/db/tasks';
import {
  FIELD_TYPES,
  PRIORITIES,
  type FieldValue,
  type Project,
  type ProjectTemplate,
  type TemplateData,
  type TemplateTask,
} from '@/lib/db/types';

/** A template as shown in the picker: built in to the app, or saved by someone in your workspace. */
export interface TemplateChoice {
  id: string;
  name: string;
  description: string;
  color: string;
  data: TemplateData;
  builtIn: boolean;
  createdBy: string | null;
}

const opt = (id: string, label: string, color: string) => ({ id, label, color });

export const BUILTIN_TEMPLATES: TemplateChoice[] = [
  {
    id: 'builtin:sprint',
    name: 'Software sprint',
    description: 'Plan a two-week sprint with story points and work types.',
    color: '#2550e8',
    builtIn: true,
    createdBy: null,
    data: {
      statuses: [
        { name: 'Backlog', color: '#64748b', isDone: false },
        { name: 'To do', color: '#78716c', isDone: false },
        { name: 'In progress', color: '#2550e8', isDone: false },
        { name: 'Code review', color: '#c9a227', isDone: false },
        { name: 'QA', color: '#7c3aed', isDone: false },
        { name: 'Done', color: '#0a8c4e', isDone: true },
      ],
      fields: [
        { name: 'Story points', type: 'number', options: [], showOnCard: true },
        { name: 'Type', type: 'select', showOnCard: true, locked: true, options: [opt('feature', 'Feature', '#2550e8'), opt('bug', 'Bug', '#e11d48'), opt('chore', 'Chore', '#64748b'), opt('spike', 'Spike', '#c9a227')] },
        { name: 'Pull request', type: 'url', options: [], showOnCard: false },
      ],
      tasks: [
        { title: 'Sprint planning meeting', status: 1, priority: 'high', dueInDays: 0, checklist: ['Review backlog', 'Agree sprint goal', 'Estimate stories'] },
        { title: 'Set up CI pipeline', status: 0, values: { '0': 3, '1': 'chore' } },
        { title: 'User profile page', status: 0, values: { '0': 5, '1': 'feature' } },
        { title: 'Sprint review and retro', status: 1, dueInDays: 13, checklist: ['Demo finished work', 'What went well', 'What to improve'] },
      ],
    },
  },
  {
    id: 'builtin:bugs',
    name: 'Bug tracking',
    description: 'Triage, fix and verify bugs by severity and environment.',
    color: '#e11d48',
    builtIn: true,
    createdBy: null,
    data: {
      statuses: [
        { name: 'New', color: '#64748b', isDone: false },
        { name: 'Triaged', color: '#c9a227', isDone: false },
        { name: 'In progress', color: '#2550e8', isDone: false },
        { name: 'Fixed', color: '#0d9488', isDone: false },
        { name: 'Verified', color: '#0a8c4e', isDone: true },
      ],
      fields: [
        { name: 'Severity', type: 'select', showOnCard: true, options: [opt('s1', 'S1 Critical', '#e11d48'), opt('s2', 'S2 Major', '#ea580c'), opt('s3', 'S3 Minor', '#c9a227'), opt('s4', 'S4 Trivial', '#64748b')] },
        { name: 'Environment', type: 'select', showOnCard: true, options: [opt('prod', 'Production', '#e11d48'), opt('staging', 'Staging', '#c9a227'), opt('dev', 'Development', '#2550e8')] },
        { name: 'Reproducible', type: 'checkbox', options: [], showOnCard: false },
        { name: 'Ticket link', type: 'url', options: [], showOnCard: false },
      ],
      tasks: [
        { title: 'Example: Login fails with SSO', status: 0, priority: 'high', values: { '0': 's2', '1': 'prod', '2': true }, description: 'Steps to reproduce:\n1. \n2. \n\nExpected:\nActual:' },
      ],
    },
  },
  {
    id: 'builtin:marketing',
    name: 'Marketing campaign',
    description: 'Take a campaign from idea to launch across channels and budget.',
    color: '#c9a227',
    builtIn: true,
    createdBy: null,
    data: {
      statuses: [
        { name: 'Ideas', color: '#64748b', isDone: false },
        { name: 'Planning', color: '#c9a227', isDone: false },
        { name: 'In production', color: '#2550e8', isDone: false },
        { name: 'Scheduled', color: '#7c3aed', isDone: false },
        { name: 'Published', color: '#0a8c4e', isDone: true },
      ],
      fields: [
        { name: 'Channel', type: 'select', showOnCard: true, options: [opt('email', 'Email', '#2550e8'), opt('social', 'Social', '#db2777'), opt('blog', 'Blog', '#0a8c4e'), opt('ads', 'Paid ads', '#ea580c'), opt('event', 'Event', '#7c3aed')] },
        { name: 'Budget', type: 'number', options: [], showOnCard: true },
        { name: 'Launch date', type: 'date', options: [], showOnCard: true },
      ],
      tasks: [
        { title: 'Define goals and KPIs', status: 1, priority: 'high', dueInDays: 3 },
        { title: 'Draft key messaging', status: 1, dueInDays: 7 },
        { title: 'Design campaign assets', status: 0, dueInDays: 14, values: { '0': 'social' } },
        { title: 'Launch email sequence', status: 0, dueInDays: 21, values: { '0': 'email' } },
        { title: 'Report results', status: 0, dueInDays: 35, checklist: ['Collect metrics', 'Compare with KPIs', 'Share learnings'] },
      ],
    },
  },
  {
    id: 'builtin:launch',
    name: 'Product launch',
    description: 'Coordinate every team for a launch, with effort sizing and blockers.',
    color: '#0a8c4e',
    builtIn: true,
    createdBy: null,
    data: {
      statuses: [
        { name: 'Not started', color: '#64748b', isDone: false },
        { name: 'In progress', color: '#2550e8', isDone: false },
        { name: 'Blocked', color: '#e11d48', isDone: false },
        { name: 'Done', color: '#0a8c4e', isDone: true },
      ],
      fields: [
        { name: 'Team', type: 'select', showOnCard: true, options: [opt('product', 'Product', '#0a8c4e'), opt('eng', 'Engineering', '#2550e8'), opt('design', 'Design', '#db2777'), opt('mkt', 'Marketing', '#c9a227'), opt('support', 'Support', '#0d9488')] },
        { name: 'Effort', type: 'select', showOnCard: true, options: [opt('s', 'S', '#0a8c4e'), opt('m', 'M', '#c9a227'), opt('l', 'L', '#e11d48')] },
      ],
      tasks: [
        { title: 'Finalize launch scope', status: 0, priority: 'high', dueInDays: 5, values: { '0': 'product', '1': 'm' } },
        { title: 'Beta testing', status: 0, dueInDays: 14, values: { '0': 'eng', '1': 'l' } },
        { title: 'Launch announcement', status: 0, dueInDays: 28, values: { '0': 'mkt', '1': 'm' } },
        { title: 'Update help docs', status: 0, dueInDays: 25, values: { '0': 'support', '1': 's' } },
      ],
    },
  },
  {
    id: 'builtin:event',
    name: 'Event planning',
    description: 'Venues, vendors, costs and payments for an event.',
    color: '#7c3aed',
    builtIn: true,
    createdBy: null,
    data: {
      statuses: [
        { name: 'To do', color: '#64748b', isDone: false },
        { name: 'Booked', color: '#c9a227', isDone: false },
        { name: 'Confirmed', color: '#2550e8', isDone: false },
        { name: 'Done', color: '#0a8c4e', isDone: true },
      ],
      fields: [
        { name: 'Vendor', type: 'text', options: [], showOnCard: true },
        { name: 'Cost', type: 'number', options: [], showOnCard: true },
        { name: 'Paid', type: 'checkbox', options: [], showOnCard: true },
      ],
      tasks: [
        { title: 'Book the venue', status: 0, priority: 'high', dueInDays: 7 },
        { title: 'Send invitations', status: 0, dueInDays: 14 },
        { title: 'Arrange catering', status: 0, dueInDays: 21 },
        { title: 'Prepare agenda', status: 0, dueInDays: 21 },
        { title: 'Post-event survey', status: 0, dueInDays: 35 },
      ],
    },
  },
];

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Accepts only well-formed template data, whatever is stored, so a broken template can never break project creation. */
export function cleanTemplateData(raw: unknown): TemplateData {
  const d = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<TemplateData>;
  const statuses = (Array.isArray(d.statuses) ? d.statuses : [])
    .slice(0, 20)
    .map((s) => ({ name: str(s?.name, 40).trim(), color: isHexColor(s?.color ?? '') ? s.color : '#64748b', isDone: s?.isDone === true }))
    .filter((s) => s.name);
  const fields = (Array.isArray(d.fields) ? d.fields : [])
    .slice(0, 30)
    .filter((f) => f && FIELD_TYPES.includes(f.type) && str(f.name, 40).trim())
    .map((f) => ({
      name: str(f.name, 40).trim(),
      type: f.type,
      showOnCard: f.showOnCard !== false,
      locked: f.locked === true,
      options: (Array.isArray(f.options) ? f.options : [])
        .slice(0, 50)
        .filter((o) => o && str(o.id, 64) && str(o.label, 60).trim())
        .map((o) => ({ id: str(o.id, 64), label: str(o.label, 60).trim(), color: isHexColor(o.color ?? '') ? o.color : '#64748b' })),
    }));
  const tasks: TemplateTask[] = (Array.isArray(d.tasks) ? d.tasks : [])
    .slice(0, 300)
    .filter((t) => t && str(t.title, 200).trim())
    .map((t) => ({
      title: str(t.title, 200).trim(),
      description: str(t.description, 10000),
      priority: PRIORITIES.includes(t.priority as never) ? t.priority : 'medium',
      status: Number.isInteger(t.status) ? Number(t.status) : 0,
      checklist: (Array.isArray(t.checklist) ? t.checklist : []).map((c) => str(c, 300).trim()).filter(Boolean).slice(0, 50),
      dueInDays: Number.isInteger(t.dueInDays) ? Number(t.dueInDays) : null,
      values: typeof t.values === 'object' && t.values !== null ? (t.values as Record<string, FieldValue>) : {},
    }));
  return { statuses: statuses.some((s) => s.isDone) ? statuses : [...statuses, { name: 'Done', color: '#0a8c4e', isDone: true }], fields, tasks };
}

/** Built-in templates first, then templates saved in this workspace (none if the templates table does not exist yet). */
export async function listTemplateChoices(): Promise<{ choices: TemplateChoice[]; savedAvailable: boolean }> {
  let saved: ProjectTemplate[] = [];
  let savedAvailable = true;
  try {
    saved = (await table('projectTemplates').list()).sort(byCreated);
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    savedAvailable = false;
  }
  return {
    savedAvailable,
    choices: [
      ...BUILTIN_TEMPLATES,
      ...saved.map((t) => ({ id: t.id, name: t.name, description: t.description, color: t.color, data: cleanTemplateData(t.data), builtIn: false, createdBy: t.createdBy })),
    ],
  };
}

export async function deleteTemplate(id: string): Promise<void> {
  const removed = await table('projectTemplates').remove({ id });
  if (!removed) throw new Error('Only the person who saved a template, or a governor, can delete it.');
}

/**
 * Creates a shared project from a template: its columns, custom fields and starter cards.
 * Returns a warning when part of it could not be copied (for example custom fields before the database update).
 */
export async function createProjectFromTemplate(input: ProjectInput, template: TemplateData | null): Promise<{ project: Project; warning: string | null }> {
  const data = template ? cleanTemplateData(template) : null;
  const project = await createProject(input, data?.statuses.length ? data.statuses : DEFAULT_STATUSES);
  if (!data) return { project, warning: null };

  let warning: string | null = null;
  const statuses = (await table('statuses').list({ projectId: project.id })).sort((a, b) => a.order - b.order);
  const fieldIds: (string | null)[] = [];
  for (const field of data.fields) {
    try {
      fieldIds.push((await createField(project.id, field)).id);
    } catch (error) {
      fieldIds.push(null);
      warning = error instanceof Error ? error.message : 'Some custom fields could not be added.';
      if (isMissingTable(error) || /database update/.test(warning)) break;
    }
  }

  const today = new Date();
  for (const task of data.tasks) {
    const status = statuses[task.status] ?? statuses[0];
    const customValues: Record<string, FieldValue> = {};
    for (const [index, value] of Object.entries(task.values ?? {})) {
      const fieldId = fieldIds[Number(index)];
      if (fieldId && value !== null && value !== '') customValues[fieldId] = value;
    }
    const created = await createTask(project.id, {
      title: task.title,
      description: task.description,
      priority: task.priority,
      statusId: status.id,
      dueDate: task.dueInDays === null || task.dueInDays === undefined ? null : toDayString(addDays(today, task.dueInDays)),
      customValues,
    });
    if (task.checklist?.length) {
      await table('checklistItems').insertMany(task.checklist.map((text, order) => ({ taskId: created.id, text, done: false, order })));
    }
  }
  return { project, warning };
}

/** Saves a project's columns and custom fields (and optionally its cards) as a reusable template. */
export async function saveProjectAsTemplate(projectId: string, input: { name: string; description: string; includeTasks: boolean }): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error('Please name the template.');
  const [project] = await table('projects').list({ id: projectId });
  if (!project) throw new Error('This project no longer exists.');
  const statuses = (await table('statuses').list({ projectId })).sort((a, b) => a.order - b.order);
  const fields = await listFields(projectId);
  const statusIndex = new Map(statuses.map((s, i) => [s.id, i]));
  const fieldIndex = new Map(fields.map((f, i) => [f.id, String(i)]));

  let tasks: TemplateTask[] = [];
  if (input.includeTasks) {
    const rows = (await table('tasks').list({ projectId })).sort((a, b) => a.order - b.order).slice(0, 300);
    const checklist = rows.length ? await table('checklistItems').list({ taskId: rows.map((t) => t.id) }) : [];
    tasks = rows.map((t) => ({
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: statusIndex.get(t.statusId) ?? 0,
      checklist: checklist.filter((c) => c.taskId === t.id).sort((a, b) => a.order - b.order).map((c) => c.text),
      values: Object.fromEntries(
        Object.entries(t.customValues ?? {}).flatMap(([id, v]) => (fieldIndex.has(id) ? [[fieldIndex.get(id)!, v]] : [])),
      ),
    }));
  }

  const data: TemplateData = {
    statuses: statuses.map((s) => ({ name: s.name, color: s.color, isDone: s.isDone })),
    fields: fields.map((f) => ({ name: f.name, type: f.type, options: f.options, showOnCard: f.showOnCard, locked: f.locked })),
    tasks,
  };
  if (JSON.stringify(data).length > 190000) throw new Error('This project is too big to save as a template. Try without cards.');
  try {
    await table('projectTemplates').insert({ name: name.slice(0, 80), description: input.description.trim().slice(0, 2000), color: project.color, data });
  } catch (error) {
    if (isMissingTable(error)) {
      throw new Error('Saving templates needs a one-time database update. Run supabase/migrations/20261030160000_custom_fields_templates.sql in the Supabase SQL Editor.');
    }
    throw error;
  }
}

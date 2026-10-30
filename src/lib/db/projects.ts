import { byCreated, table } from '@/lib/db/tables';
import { isHexColor } from '@/lib/colors';
import type { Project } from '@/lib/db/types';

export interface ProjectInput {
  name: string;
  description: string;
  color: string;
}

export const DEFAULT_STATUSES = [
  { name: 'To do', color: '#64748b', isDone: false },
  { name: 'In progress', color: '#2550e8', isDone: false },
  { name: 'Review', color: '#c9a227', isDone: false },
  { name: 'Done', color: '#0a8c4e', isDone: true },
];

function clean(input: ProjectInput): ProjectInput {
  const name = input.name.trim();
  if (!name) throw new Error('Please enter a project name.');
  if (name.length > 80) throw new Error('Project names can be at most 80 characters.');
  if (!isHexColor(input.color)) throw new Error('Please pick a color.');
  return { name, description: input.description.trim().slice(0, 2000), color: input.color };
}

export async function listProjects(): Promise<Project[]> {
  const projects = await table('projects').list();
  return projects.sort((a, b) => Number(b.isPersonal) - Number(a.isPersonal) || byCreated(a, b));
}

export const getProject = (id: string): Promise<Project | null> => table('projects').find(id);

export async function createProject(input: ProjectInput): Promise<Project> {
  const project = await table('projects').insert(clean(input));
  await table('statuses').insertMany(DEFAULT_STATUSES.map((s, order) => ({ ...s, projectId: project.id, order })));
  return project;
}

export const updateProject = (id: string, input: ProjectInput): Promise<Project> => table('projects').update(id, clean(input));

export async function archiveProject(id: string): Promise<void> {
  await table('projects').update(id, { archivedAt: new Date().toISOString() });
}

export async function restoreProject(id: string): Promise<void> {
  await table('projects').update(id, { archivedAt: null });
}

/** Statuses, tasks and everything attached to them are removed together with the project. */
export async function deleteProject(id: string): Promise<void> {
  const removed = await table('projects').remove({ id });
  if (!removed) throw new Error('This project could not be deleted. Only administrators can delete shared projects.');
}

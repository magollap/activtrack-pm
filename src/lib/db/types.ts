export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type NewRecord<T extends BaseRecord> = Omit<T, keyof BaseRecord>;

export const ROLES = ['governor', 'delegate', 'reporter'] as const;
export type Role = (typeof ROLES)[number];
export type AuthSource = 'local' | 'ldap';

/** A person with an account. */
export interface Member extends BaseRecord {
  name: string;
  email: string;
  color: string;
  role: Role;
  disabled: boolean;
  authSource: AuthSource;
}

export interface Project extends BaseRecord {
  name: string;
  description: string;
  color: string;
  archivedAt: string | null;
  isPersonal: boolean;
  ownerId: string | null;
  createdBy: string | null;
}

export const ACCESS_LEVELS = ['read', 'write', 'write_delete'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];
/**
 * What the signed-in person may do in a project: "manage" is governors and owners of a personal space,
 * "lead" is a delegate in a project they created (everything except deleting the project).
 */
export type ProjectAccess = AccessLevel | 'lead' | 'manage';

export interface ProjectMember extends BaseRecord {
  projectId: string;
  userId: string;
  access: AccessLevel;
}

export interface Status extends BaseRecord {
  projectId: string;
  name: string;
  color: string;
  order: number;
  isDone: boolean;
}

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface Task extends BaseRecord {
  projectId: string;
  title: string;
  description: string;
  statusId: string;
  priority: Priority;
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  order: number;
  completedAt: string | null;
  createdBy: string | null;
}

export interface ChecklistItem extends BaseRecord {
  taskId: string;
  text: string;
  done: boolean;
  order: number;
}

export interface Comment extends BaseRecord {
  taskId: string;
  authorId: string | null;
  body: string;
}

export type HistoryField = 'title' | 'status' | 'priority' | 'assignee' | 'dueDate';

export interface TaskHistoryEntry extends BaseRecord {
  taskId: string;
  field: HistoryField;
  from: string | null;
  to: string | null;
  actorId: string | null;
}

export interface Collections {
  profiles: Member;
  projects: Project;
  projectMembers: ProjectMember;
  statuses: Status;
  tasks: Task;
  checklistItems: ChecklistItem;
  comments: Comment;
  taskHistory: TaskHistoryEntry;
}

export type CollectionName = keyof Collections;

export const COLLECTION_NAMES: CollectionName[] = [
  'profiles',
  'projects',
  'projectMembers',
  'statuses',
  'tasks',
  'checklistItems',
  'comments',
  'taskHistory',
];

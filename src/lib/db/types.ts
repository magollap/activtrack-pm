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
  /** Custom field values keyed by field id. Missing on databases that predate custom fields. */
  customValues?: Record<string, FieldValue>;
}

export const FIELD_TYPES = ['text', 'number', 'date', 'select', 'checkbox', 'url'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
export type FieldValue = string | number | boolean | null;

export interface FieldOption {
  id: string;
  label: string;
  color: string;
}

/** A project-specific field shown on every card in that project. */
export interface CustomField extends BaseRecord {
  projectId: string;
  name: string;
  type: FieldType;
  options: FieldOption[];
  order: number;
  showOnCard: boolean;
  /** Only project leads and governors may set or change this field's values. */
  locked: boolean;
}

export interface TemplateField {
  name: string;
  type: FieldType;
  options: FieldOption[];
  showOnCard: boolean;
  locked?: boolean;
}

export interface TemplateTask {
  title: string;
  description?: string;
  priority?: Priority;
  /** Index into the template's statuses. */
  status: number;
  checklist?: string[];
  /** Due date as days after the project is created. */
  dueInDays?: number | null;
  /** Field values keyed by the field's index in the template. */
  values?: Record<string, FieldValue>;
}

export interface TemplateData {
  statuses: { name: string; color: string; isDone: boolean }[];
  fields: TemplateField[];
  tasks: TemplateTask[];
}

export interface ProjectTemplate extends BaseRecord {
  name: string;
  description: string;
  color: string;
  data: TemplateData;
  createdBy: string | null;
}

export type AutomationTrigger =
  | { type: 'task_created' }
  | { type: 'status_changed'; statusId: string }
  | { type: 'priority_changed'; priority: Priority };

export type AutomationAction =
  | { type: 'set_assignee'; assignee: string | null }
  | { type: 'set_priority'; priority: Priority }
  | { type: 'move_to_status'; statusId: string }
  | { type: 'set_due_in_days'; days: number }
  | { type: 'add_checklist'; items: string[] }
  | { type: 'add_comment'; text: string };

/** "When <trigger>, then <actions>" for one project. */
export interface Automation extends BaseRecord {
  projectId: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  createdBy: string | null;
}

export const HEALTH_VALUES = ['on_track', 'at_risk', 'off_track', 'complete'] as const;
export type Health = (typeof HEALTH_VALUES)[number];

export interface StatusUpdate extends BaseRecord {
  projectId: string;
  health: Health;
  title: string;
  body: string;
  authorId: string | null;
}

export interface TimeEntry extends BaseRecord {
  taskId: string;
  userId: string | null;
  startedAt: string;
  /** Null while the timer is running. */
  endedAt: string | null;
  minutes: number;
  note: string;
}

export interface Attachment extends BaseRecord {
  taskId: string;
  name: string;
  size: number;
  mimeType: string;
  path: string;
  uploadedBy: string | null;
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
  customFields: CustomField;
  projectTemplates: ProjectTemplate;
  automations: Automation;
  statusUpdates: StatusUpdate;
  timeEntries: TimeEntry;
  attachments: Attachment;
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
  'customFields',
  'projectTemplates',
  'automations',
  'statusUpdates',
  'timeEntries',
  'attachments',
];

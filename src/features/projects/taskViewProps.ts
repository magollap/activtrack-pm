import type { ChecklistCount } from '@/hooks/useProjectData';
import type { CustomField, Member, Status, Task } from '@/lib/db/types';

export interface TaskViewProps {
  projectId: string;
  statuses: Status[];
  tasks: Task[];
  members: Member[];
  checklist: Map<string, ChecklistCount>;
  fields: CustomField[];
  timeByTask?: Map<string, number>;
  attachmentsByTask?: Map<string, number>;
  /** False for read-only access: no dragging or inline edits. */
  editable: boolean;
  onOpenTask: (taskId: string) => void;
}

import type { ChecklistCount } from '@/hooks/useProjectData';
import type { Member, Status, Task } from '@/lib/db/types';

export interface TaskViewProps {
  projectId: string;
  statuses: Status[];
  tasks: Task[];
  members: Member[];
  checklist: Map<string, ChecklistCount>;
  /** False for read-only access: no dragging or inline edits. */
  editable: boolean;
  onOpenTask: (taskId: string) => void;
}

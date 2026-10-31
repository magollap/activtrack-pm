import { PRIORITY_META } from '@/lib/priority';
import type { Automation, Member, Status } from '@/lib/db/types';

/** Plain-English description, e.g. "When a card moves to Review: assign to Priya; set priority to High". */
export function describeAutomation(rule: Pick<Automation, 'trigger' | 'actions'>, statuses: Status[], members: Member[]): string {
  const status = (id: string) => statuses.find((s) => s.id === id)?.name ?? 'a removed status';
  const when =
    rule.trigger.type === 'task_created' ? 'a card is created'
      : rule.trigger.type === 'status_changed' ? `a card moves to ${status(rule.trigger.statusId)}`
      : `a card's priority becomes ${PRIORITY_META[rule.trigger.priority].label}`;
  const then = rule.actions.map((a) => {
    switch (a.type) {
      case 'set_assignee': return a.assignee === 'creator' ? 'assign it to whoever created it' : a.assignee ? `assign it to ${members.find((m) => m.id === a.assignee)?.name ?? 'a former member'}` : 'unassign it';
      case 'set_priority': return `set priority to ${PRIORITY_META[a.priority].label}`;
      case 'move_to_status': return `move it to ${status(a.statusId)}`;
      case 'set_due_in_days': return a.days === 0 ? 'make it due today' : `make it due in ${a.days} day${a.days === 1 ? '' : 's'}`;
      case 'add_checklist': return `add ${a.items.length} checklist item${a.items.length === 1 ? '' : 's'}`;
      case 'add_comment': return 'add a comment';
    }
  });
  return `When ${when}: ${then.join('; ')}.`;
}


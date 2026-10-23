import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useQuery } from '@/hooks/useQuery';
import { countTasksInStatus, deleteStatus } from '@/lib/db/statuses';
import type { Status } from '@/lib/db/types';

interface DeleteStatusDialogProps {
  status: Status;
  statuses: Status[];
  onClose: () => void;
}

export function DeleteStatusDialog({ status, statuses, onClose }: DeleteStatusDialogProps) {
  const others = statuses.filter((s) => s.id !== status.id);
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? '');
  const { data: count = 0 } = useQuery(() => countTasksInStatus(status.id), `count:${status.id}`);

  return (
    <ConfirmDialog
      title={`Delete "${status.name}"?`}
      message={
        count > 0
          ? `This status has ${count} task${count === 1 ? '' : 's'}. Choose where to move ${count === 1 ? 'it' : 'them'}.`
          : 'This status has no tasks. It will be removed from the workflow.'
      }
      confirmLabel="Delete status"
      onConfirm={() => deleteStatus(status.id, count > 0 ? moveTo : null)}
      onClose={onClose}
    >
      {count > 0 && (
        <div>
          <label className="label" htmlFor="move-to">Move tasks to</label>
          <select id="move-to" className="input" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
            {others.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
    </ConfirmDialog>
  );
}

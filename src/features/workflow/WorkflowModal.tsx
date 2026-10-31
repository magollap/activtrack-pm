import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Modal } from '@/components/Modal';
import { StatusRow } from '@/features/workflow/StatusRow';
import { DeleteStatusDialog } from '@/features/workflow/DeleteStatusDialog';
import { createStatus, reorderStatuses } from '@/lib/db/statuses';
import { pickColor } from '@/lib/colors';
import { useToast } from '@/hooks/useToast';
import type { Status } from '@/lib/db/types';
import { HelpLink } from '@/features/help/HelpLink';

interface WorkflowModalProps {
  projectId: string;
  statuses: Status[];
  onClose: () => void;
}

export function WorkflowModal({ projectId, statuses, onClose }: WorkflowModalProps) {
  const toast = useToast();
  const [order, setOrder] = useState(statuses.map((s) => s.id));
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<Status | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => setOrder(statuses.map((s) => s.id)), [statuses]);

  const byId = new Map(statuses.map((s) => [s.id, s]));
  const ordered = order.map((id) => byId.get(id)).filter((s): s is Status => Boolean(s));

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    try {
      await reorderStatuses(projectId, next);
    } catch (error) {
      toast.error(error);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createStatus(projectId, { name: newName, color: pickColor(statuses.length + 2), isDone: false });
      setNewName('');
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <>
      <Modal title="Workflow" onClose={onClose} footer={<><HelpLink section="workflow" /><button className="btn-primary" onClick={onClose}>Done</button></>}>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Drag to reorder. Tasks moved into a status marked <strong>Done</strong> count as completed.
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {ordered.map((status) => (
                <StatusRow key={status.id} status={status} onDelete={() => setDeleting(status)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <form onSubmit={add} className="mt-4 flex gap-2">
          <input className="input" placeholder="New status name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} />
          <button className="btn-secondary shrink-0" disabled={!newName.trim()}><Plus className="h-4 w-4" /> Add</button>
        </form>
      </Modal>
      {deleting && (
        <DeleteStatusDialog status={deleting} statuses={statuses} onClose={() => setDeleting(null)} />
      )}
    </>
  );
}

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskCard } from '@/features/board/TaskCard';
import type { ComponentProps } from 'react';

type SortableTaskCardProps = Omit<ComponentProps<typeof TaskCard>, 'dragging' | 'overlay'>;

export function SortableTaskCard(props: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="touch-manipulation"
      {...attributes}
      {...listeners}
      tabIndex={-1}
    >
      <TaskCard {...props} dragging={isDragging} />
    </div>
  );
}

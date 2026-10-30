import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { createTask } from '@/lib/db/tasks';
import { useToast } from '@/hooks/useToast';
import { onCommand } from '@/lib/commands';

interface QuickAddProps {
  projectId: string;
  statusId: string;
  placeholder?: string;
  dueDate?: string;
  autoFocus?: boolean;
  compact?: boolean;
  /** Focus this box when the "N" shortcut is pressed. */
  listenForShortcut?: boolean;
  onCancel?: () => void;
}

export function QuickAdd({ projectId, statusId, placeholder = 'Add a task, press Enter', dueDate, autoFocus, compact, listenForShortcut, onCancel }: QuickAddProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!listenForShortcut) return;
    return onCommand('quick-add', () => inputRef.current?.focus());
  }, [listenForShortcut]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await createTask(projectId, { title, statusId, dueDate: dueDate ?? null });
      setTitle('');
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <form onSubmit={submit} className="relative">
      <Plus className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onCancel?.()}
        onBlur={() => !title.trim() && onCancel?.()}
        placeholder={placeholder}
        maxLength={200}
        autoFocus={autoFocus}
        aria-label="New task title"
        className={`input ${compact ? 'py-1.5 pl-8 text-sm' : 'py-2.5 pl-9'}`}
      />
    </form>
  );
}

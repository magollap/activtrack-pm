import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/hooks/useToast';
import { saveProjectAsTemplate } from '@/lib/db/templates';
import type { Project } from '@/lib/db/types';

/** Saves the project's columns and custom fields, and optionally its cards, as a reusable template. */
export function SaveTemplateModal({ project, taskCount, onClose }: { project: Project; taskCount: number; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(project.isPersonal ? 'My template' : `${project.name} template`.slice(0, 80));
  const [description, setDescription] = useState(project.description);
  const [includeTasks, setIncludeTasks] = useState(taskCount > 0 && taskCount <= 50);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveProjectAsTemplate(project.id, { name, description, includeTasks });
      toast.success('Template saved. Pick it when you create a new project.');
      onClose();
    } catch (error) {
      toast.error(error);
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Save as template"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="template-form" className="btn-primary" disabled={busy || !name.trim()}>Save template</button>
        </>
      }
    >
      <form id="template-form" onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Saves this project's columns and custom fields so anyone who creates projects can start from it.
        </p>
        <div>
          <label className="label" htmlFor="template-name">Template name</label>
          <input id="template-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="template-description">Description</label>
          <textarea id="template-description" className="input min-h-[70px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="When to use this template" />
        </div>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" checked={includeTasks} onChange={(e) => setIncludeTasks(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" disabled={taskCount === 0} />
          <span>
            Include the {taskCount} card{taskCount === 1 ? '' : 's'}
            <span className="block text-xs text-slate-500 dark:text-slate-400">Titles, descriptions, priorities, checklists and field values. Assignees, dates and comments are left out.</span>
          </span>
        </label>
      </form>
    </Modal>
  );
}

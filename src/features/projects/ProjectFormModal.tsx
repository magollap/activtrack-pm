import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, LayoutTemplate, Trash2 } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { ColorPicker } from '@/components/ColorPicker';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useCurrentUser } from '@/features/auth/AuthProvider';
import { updateProject } from '@/lib/db/projects';
import { createProjectFromTemplate, deleteTemplate, listTemplateChoices, type TemplateChoice } from '@/lib/db/templates';
import { pickColor } from '@/lib/colors';
import { useQuery } from '@/hooks/useQuery';
import { useToast } from '@/hooks/useToast';
import type { Project } from '@/lib/db/types';

interface ProjectFormModalProps {
  project?: Project;
  onClose: () => void;
}

export function ProjectFormModal({ project, onClose }: ProjectFormModalProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const me = useCurrentUser();
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [color, setColor] = useState(project?.color ?? pickColor(Math.floor(Math.random() * 12)));
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TemplateChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const { data } = useQuery(() => (project ? Promise.resolve(null) : listTemplateChoices()), `templates:${project?.id ?? 'new'}`);
  const template = data?.choices.find((t) => t.id === templateId) ?? null;

  const choose = (choice: TemplateChoice | null) => {
    setTemplateId(choice?.id ?? null);
    if (choice) {
      if (!name.trim() || data?.choices.some((t) => t.name === name)) setName(choice.name);
      if (!description.trim() || data?.choices.some((t) => t.description === description)) setDescription(choice.description);
      setColor(choice.color);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (project) {
        await updateProject(project.id, { name, description, color });
        toast.success('Project updated');
      } else {
        const { project: created, warning } = await createProjectFromTemplate({ name, description, color }, template?.data ?? null);
        if (warning) toast.error(new Error(warning));
        navigate(`/projects/${created.id}`);
      }
      onClose();
    } catch (error) {
      toast.error(error);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={project ? 'Edit project' : 'New project'}
      onClose={onClose}
      size={project ? 'md' : 'lg'}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="project-form" className="btn-primary" disabled={busy || !name.trim()}>
            {project ? 'Save changes' : template ? 'Create from template' : 'Create project'}
          </button>
        </>
      }
    >
      <form id="project-form" onSubmit={submit} className="space-y-4">
        {!project && (
          <div>
            <span className="label">Start from</span>
            <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2" role="radiogroup" aria-label="Template">
              <TemplateCard selected={!template} onSelect={() => choose(null)} name="Blank project" description="To do, In progress, Review and Done." color="#64748b" />
              {data?.choices.map((choice) => (
                <TemplateCard
                  key={choice.id}
                  selected={template?.id === choice.id}
                  onSelect={() => choose(choice)}
                  name={choice.name}
                  description={choice.description || `${choice.data.statuses.length} columns`}
                  color={choice.color}
                  badge={choice.builtIn ? undefined : 'Saved'}
                  onDelete={!choice.builtIn && (choice.createdBy === me.id || me.role === 'governor') ? () => setDeleting(choice) : undefined}
                />
              ))}
            </div>
            {template && (
              <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">Columns:</span>
                  {template.data.statuses.map((s) => (
                    <span key={s.name} className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</span>
                  ))}
                </p>
                {template.data.fields.length > 0 && <p className="mt-1"><span className="font-medium">Fields:</span> {template.data.fields.map((f) => f.name).join(', ')}</p>}
                {template.data.tasks.length > 0 && <p className="mt-1"><span className="font-medium">Starter cards:</span> {template.data.tasks.length}</p>}
              </div>
            )}
          </div>
        )}
        <div>
          <label className="label" htmlFor="project-name">Name</label>
          <input id="project-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus placeholder="e.g. Website redesign" />
        </div>
        <div>
          <label className="label" htmlFor="project-description">Description</label>
          <textarea id="project-description" className="input min-h-[80px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="What is this project about?" />
        </div>
        <div>
          <span className="label">Color</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </form>

      {deleting && (
        <ConfirmDialog
          title="Delete template?"
          message={`"${deleting.name}" will no longer be offered for new projects. Projects already made from it are not affected.`}
          confirmLabel="Delete template"
          onConfirm={async () => {
            await deleteTemplate(deleting.id);
            if (templateId === deleting.id) setTemplateId(null);
            toast.success('Template deleted');
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </Modal>
  );
}

interface TemplateCardProps {
  selected: boolean;
  onSelect: () => void;
  name: string;
  description: string;
  color: string;
  badge?: string;
  onDelete?: () => void;
}

function TemplateCard({ selected, onSelect, name, description, color, badge, onDelete }: TemplateCardProps) {
  return (
    <div className="relative">
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className={`flex h-full w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
          selected
            ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-500/10'
            : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
        }`}
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: color }}>
          {selected ? <Check className="h-4 w-4" /> : <LayoutTemplate className="h-4 w-4" />}
        </span>
        <span className={`min-w-0 flex-1 ${onDelete ? 'pr-7' : ''}`}>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{name}</span>
            {badge && <span className="shrink-0 rounded bg-gold-100 px-1.5 text-[10px] font-semibold uppercase text-gold-800 dark:bg-gold-500/15 dark:text-gold-300">{badge}</span>}
          </span>
          <span className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{description}</span>
        </span>
      </button>
      {onDelete && (
        <button type="button" onClick={onDelete} className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:text-red-600" aria-label={`Delete template ${name}`}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

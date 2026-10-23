import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/Modal';
import { ColorPicker } from '@/components/ColorPicker';
import { createProject, updateProject } from '@/lib/db/projects';
import { pickColor } from '@/lib/colors';
import { useToast } from '@/hooks/useToast';
import type { Project } from '@/lib/db/types';

interface ProjectFormModalProps {
  project?: Project;
  onClose: () => void;
}

export function ProjectFormModal({ project, onClose }: ProjectFormModalProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [color, setColor] = useState(project?.color ?? pickColor(Math.floor(Math.random() * 12)));
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (project) {
        await updateProject(project.id, { name, description, color });
        toast.success('Project updated');
      } else {
        const created = await createProject({ name, description, color });
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
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="project-form" className="btn-primary" disabled={busy || !name.trim()}>
            {project ? 'Save changes' : 'Create project'}
          </button>
        </>
      }
    >
      <form id="project-form" onSubmit={submit} className="space-y-4">
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
    </Modal>
  );
}

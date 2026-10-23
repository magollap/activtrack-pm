import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { RolePicker } from '@/features/admin/RolePicker';
import { useToast } from '@/hooks/useToast';
import { adminCreateUser } from '@/lib/db/users';
import { errorMessage } from '@/lib/errors';
import type { Role } from '@/lib/db/types';

export function AddUserModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('reporter');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length >= 8;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await adminCreateUser({ name: name.trim(), email: email.trim(), password, role });
      toast.success(`${name.trim()} can now sign in`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Add a user"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="add-user-form" className="btn-primary" disabled={busy || !valid}>
            <UserPlus className="h-4 w-4" /> {busy ? 'Creating...' : 'Create account'}
          </button>
        </>
      }
    >
      <form id="add-user-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="new-user-name">Full name</label>
            <input id="new-user-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="new-user-email">Email</label>
            <input id="new-user-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="new-user-password">Temporary password</label>
          <input
            id="new-user-password"
            type="text"
            className="input font-mono"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
          />
          <p className="mt-1 text-xs text-slate-500">At least 8 characters. Share it with them privately.</p>
        </div>
        <div>
          <span className="label">Role</span>
          <RolePicker value={role} onChange={setRole} />
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">{error}</p>}
      </form>
    </Modal>
  );
}

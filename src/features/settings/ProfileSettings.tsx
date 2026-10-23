import { useState } from 'react';
import { KeyRound, Network, Save, ShieldCheck, User } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { ColorPicker } from '@/components/ColorPicker';
import { useCurrentUser } from '@/features/auth/AuthProvider';
import { useToast } from '@/hooks/useToast';
import { updateMyProfile } from '@/lib/db/members';

export function ProfileSettings() {
  const me = useCurrentUser();
  const toast = useToast();
  const [name, setName] = useState(me.name);
  const [color, setColor] = useState(me.color);
  const [busy, setBusy] = useState(false);
  const dirty = name.trim() !== me.name || color !== me.color;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateMyProfile(me.id, { name, color });
      toast.success('Profile saved');
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card">
      <header className="flex items-center gap-4 border-b border-slate-100 px-5 py-5 dark:border-slate-800">
        <Avatar member={{ ...me, name: name.trim() || me.name, color }} size="md" />
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{name.trim() || me.name}</h3>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{me.email}</p>
        </div>
      </header>
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium dark:bg-slate-800">
            {me.role === 'admin' ? <ShieldCheck className="h-3.5 w-3.5 text-brand-600" /> : <User className="h-3.5 w-3.5" />}
            {me.role === 'admin' ? 'Admin' : 'Member'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium dark:bg-slate-800">
            {me.authSource === 'ldap' ? <Network className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
            {me.authSource === 'ldap' ? 'Signs in with the company directory' : 'Signs in with a Workday password'}
          </span>
        </div>
        <div>
          <label className="label" htmlFor="profile-name">Display name</label>
          <input id="profile-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>
        <div>
          <span className="label">Avatar color</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </div>
      <footer className="flex justify-end border-t border-slate-100 px-5 py-3 dark:border-slate-800">
        <button className="btn-primary" disabled={busy || !dirty || !name.trim()}><Save className="h-4 w-4" /> Save profile</button>
      </footer>
    </form>
  );
}

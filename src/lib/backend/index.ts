import { createLocalBackend } from '@/lib/backend/local';
import { createSupabaseBackend } from '@/lib/backend/supabase';
import type { Backend } from '@/lib/backend/types';

let active: Backend | null = null;

async function hasLocalServer(): Promise<boolean> {
  try {
    const response = await fetch('/api/health', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    return typeof body === 'object' && body !== null && (body as { app?: unknown }).app === 'workday';
  } catch {
    return false;
  }
}

/** Installed copies answer on /api/health; hosted copies fall back to the online database. */
export async function selectBackend(): Promise<Backend> {
  if (await hasLocalServer()) {
    active = createLocalBackend();
    return active;
  }
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Workday could not find its server or its online database.');
  active = createSupabaseBackend(url, key);
  return active;
}

export function backend(): Backend {
  if (!active) throw new Error('Workday is still starting up.');
  return active;
}

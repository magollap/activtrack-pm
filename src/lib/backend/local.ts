import type { AuthOptions, AuthSettings, Backend, Filter, LdapTestResult } from '@/lib/backend/types';
import type { CollectionName, Collections } from '@/lib/db/types';

type Listener = () => void;

export function createLocalBackend(): Backend {
  const listeners = new Set<Listener>();
  const notify = () => listeners.forEach((listener) => listener());

  async function call<T>(path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`/api/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'same-origin',
        headers: body === undefined ? { 'X-Workday': '1' } : { 'Content-Type': 'application/json', 'X-Workday': '1' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error('Could not reach the ActivTrack server. Check that it is running and you are on the network.');
    }
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // Handled by the checks below.
    }
    const message =
      typeof payload === 'object' && payload !== null && typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : null;
    if (response.status === 401 && !path.startsWith('auth/')) notify();
    if (!response.ok) throw new Error(message ?? `The server could not complete the request (${response.status}).`);
    if (typeof payload !== 'object' || payload === null) throw new Error('The server sent an unexpected response.');
    return payload as T;
  }

  return {
    kind: 'local',

    async list<C extends CollectionName>(collection: C, filter?: Filter<Collections[C]>) {
      const { rows } = await call<{ rows: Collections[C][] }>(`data/${collection}/list`, { filter: filter ?? {} });
      return rows;
    },

    async insert<C extends CollectionName>(collection: C, rows: Record<string, unknown>[]) {
      if (!rows.length) return [];
      const result = await call<{ rows: Collections[C][] }>(`data/${collection}/insert`, { rows });
      return result.rows;
    },

    async update<C extends CollectionName>(collection: C, id: string, patch: Record<string, unknown>) {
      const { row } = await call<{ row: Collections[C] }>(`data/${collection}/update`, { id, patch });
      return row;
    },

    async remove<C extends CollectionName>(collection: C, filter: Filter<Collections[C]>) {
      const { removed } = await call<{ removed: number }>(`data/${collection}/remove`, { filter });
      return removed;
    },

    async currentUserId() {
      const { userId } = await call<{ userId: string | null }>('auth/me');
      return userId;
    },

    async authOptions() {
      return call<AuthOptions>('auth/options');
    },

    async signIn(method, identifier, password) {
      await call('auth/signin', { method, identifier: identifier.trim(), password });
      notify();
    },

    async signUp(name, email, password) {
      await call('auth/signup', { name: name.trim(), email: email.trim(), password });
      notify();
      return { confirmEmail: false };
    },

    async signOut() {
      await call('auth/signout', {});
      notify();
    },

    onAuthChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async adminCreateUser(user) {
      await call('admin/users/create', user);
    },

    async adminUpdateUser(userId, role, disabled) {
      await call('admin/users/update', { userId, role, disabled });
    },

    async getAuthSettings() {
      const { settings } = await call<{ settings: AuthSettings }>('admin/auth-settings');
      return settings;
    },

    async saveAuthSettings(settings) {
      await call('admin/auth-settings', { settings });
    },

    async testLdap(settings, username, password) {
      const { result } = await call<{ result: LdapTestResult }>('admin/ldap-test', { settings, username, password });
      return result;
    },

    async uploadFile(path, file) {
      let response: Response;
      try {
        response = await fetch(`/api/files/upload?path=${encodeURIComponent(path)}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/octet-stream', 'X-Workday': '1' },
          body: file,
        });
      } catch {
        throw new Error('Could not reach the ActivTrack server.');
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'The file could not be uploaded.');
      }
    },

    async fileUrl(path, downloadName) {
      return `/api/files/get?path=${encodeURIComponent(path)}${downloadName ? `&download=${encodeURIComponent(downloadName)}` : ''}`;
    },

    async deleteFile() {
      // The server removes the file when its attachment record is deleted.
    },

    async apiHeaders() {
      return { 'X-Workday': '1' };
    },

    watch(listener) {
      // The install server has no push channel, so check for teammates' changes every 30 seconds while visible.
      const timer = window.setInterval(() => {
        if (document.visibilityState === 'visible') listener('tasks');
      }, 30_000);
      return () => window.clearInterval(timer);
    },
  };
}

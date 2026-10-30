import { createClient, type PostgrestError } from '@supabase/supabase-js';
import type { Backend, Filter } from '@/lib/backend/types';
import type { CollectionName, Collections } from '@/lib/db/types';

const TABLES: Record<CollectionName, string> = {
  profiles: 'profiles',
  projects: 'projects',
  projectMembers: 'project_members',
  statuses: 'statuses',
  tasks: 'tasks',
  checklistItems: 'checklist_items',
  comments: 'comments',
  taskHistory: 'task_history',
  customFields: 'custom_fields',
  projectTemplates: 'project_templates',
};

const FROM_TABLE: Record<string, CollectionName> = Object.fromEntries(
  Object.entries(TABLES).map(([collection, tableName]) => [tableName, collection as CollectionName]),
);

const TO_DB: Record<string, string> = { order: 'position', from: 'from_value', to: 'to_value' };
const FROM_DB: Record<string, string> = Object.fromEntries(Object.entries(TO_DB).map(([k, v]) => [v, k]));

const toDbKey = (key: string) => TO_DB[key] ?? key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const fromDbKey = (key: string) => FROM_DB[key] ?? key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function toDb(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [toDbKey(k), v]));
}

function fromDb<T>(row: Record<string, unknown>): T {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [fromDbKey(k), v])) as T;
}

function friendly(error: PostgrestError | { message: string; code?: string }): Error {
  if (error.code === '42501') return new Error('You do not have permission to do that.');
  if (error.code === '23503') return new Error('This item is linked to something that no longer exists.');
  if (error.code === '23514') return new Error('Some of the values you entered are not allowed.');
  return new Error(error.message || 'Something went wrong talking to the server.');
}

type Query = {
  eq(column: string, value: unknown): Query;
  is(column: string, value: null | boolean): Query;
  in(column: string, values: unknown[]): Query;
};

function applyFilter<Q>(query: Q, filter: object = {}): Q {
  let q = query as unknown as Query;
  for (const [key, value] of Object.entries(filter)) {
    const column = toDbKey(key);
    if (Array.isArray(value)) q = q.in(column, value);
    else if (value === null) q = q.is(column, null);
    else q = q.eq(column, value);
  }
  return q as unknown as Q;
}

const AUTH_ERRORS: [RegExp, string][] = [
  [/invalid login credentials/i, 'That email and password do not match an account.'],
  [/already registered|already exists/i, 'An account with this email already exists. Try signing in instead.'],
  [/password should be at least/i, 'Passwords must be at least 8 characters.'],
  [/email not confirmed/i, 'Please confirm your email first: open the link we sent to your inbox, then sign in.'],
  [/email rate limit/i, 'Too many emails were sent in the last hour. Check your inbox for an earlier confirmation link, or try again later.'],
  [/rate limit|too many requests/i, 'Too many attempts. Please wait a few minutes and try again.'],
  [/fetch/i, 'Could not reach the server. Check your internet connection.'],
];

function authError(message: string): Error {
  return new Error(AUTH_ERRORS.find(([pattern]) => pattern.test(message))?.[1] ?? message);
}

const LOCAL_ONLY = 'This setting is only available when ActivTrack is installed on your own server.';

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const supabase = createClient(url, anonKey);

  return {
    kind: 'cloud',

    async list<C extends CollectionName>(collection: C, filter?: Filter<Collections[C]>) {
      const { data, error } = await applyFilter(supabase.from(TABLES[collection]).select('*'), filter);
      if (error) throw friendly(error);
      return (data ?? []).map((row) => fromDb<Collections[C]>(row));
    },

    async insert<C extends CollectionName>(collection: C, rows: Record<string, unknown>[]) {
      if (!rows.length) return [];
      const { data, error } = await supabase.from(TABLES[collection]).insert(rows.map(toDb)).select('*');
      if (error) throw friendly(error);
      return (data ?? []).map((row) => fromDb<Collections[C]>(row));
    },

    async update<C extends CollectionName>(collection: C, id: string, patch: Record<string, unknown>) {
      const { data, error } = await supabase
        .from(TABLES[collection])
        .update(toDb(patch))
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) throw friendly(error);
      if (!data) throw new Error('This item no longer exists, or you do not have permission to change it.');
      return fromDb<Collections[C]>(data);
    },

    async remove<C extends CollectionName>(collection: C, filter: Filter<Collections[C]>) {
      const { data, error } = await applyFilter(supabase.from(TABLES[collection]).delete(), filter).select('id');
      if (error) throw friendly(error);
      return data?.length ?? 0;
    },

    async currentUserId() {
      const { data } = await supabase.auth.getSession();
      return data.session?.user.id ?? null;
    },

    async authOptions() {
      return { local: true, ldap: false, signUp: true };
    },

    async signIn(method, identifier, password) {
      if (method !== 'local') throw new Error('Directory (LDAP) sign-in is only available on installed versions of ActivTrack.');
      const { error } = await supabase.auth.signInWithPassword({ email: identifier.trim(), password });
      if (error) throw authError(error.message);
    },

    async signUp(name, email, password) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        // Send the confirmation link back to whichever address the person signed up on.
        options: { data: { name: name.trim() }, emailRedirectTo: window.location.origin },
      });
      if (error) throw authError(error.message);
      // Supabase hides duplicate emails by returning a user without identities.
      if (data.user && data.user.identities?.length === 0) {
        throw authError('already registered');
      }
      // No session means "Confirm email" is on in Supabase: the person must click the emailed link first.
      return { confirmEmail: !data.session };
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) throw authError(error.message);
    },

    onAuthChange(listener) {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
          setTimeout(listener, 0);
        }
      });
      return () => data.subscription.unsubscribe();
    },

    async adminCreateUser(user) {
      const { data, error } = await supabase.functions.invoke<{ id?: string; error?: string }>('admin-create-user', { body: user });
      if (error) {
        let message = 'Could not create the account.';
        const context: unknown = (error as { context?: unknown }).context;
        if (context instanceof Response) {
          const body: unknown = await context.json().catch(() => null);
          if (typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string') {
            message = (body as { error: string }).error;
          }
        }
        throw new Error(message);
      }
      if (!data || typeof data.id !== 'string') throw new Error('Could not create the account.');
    },

    async adminUpdateUser(userId, role, disabled) {
      const { error } = await supabase.rpc('admin_update_user', {
        target_id: userId,
        new_role: role,
        new_disabled: disabled,
      });
      if (error) throw friendly(error);
    },

    async getAuthSettings() {
      throw new Error(LOCAL_ONLY);
    },

    async saveAuthSettings() {
      throw new Error(LOCAL_ONLY);
    },

    async testLdap() {
      throw new Error(LOCAL_ONLY);
    },

    async apiHeaders() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session has ended. Please sign in again.');
      return { Authorization: `Bearer ${token}` };
    },

    watch(listener) {
      // Supabase Realtime sends row changes the signed-in person is allowed to see (row level security applies).
      // Tables must be in the supabase_realtime publication; see supabase/migrations/*_realtime.sql.
      const pending = new Set<CollectionName>();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const channel = supabase
        .channel('activtrack-live')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          const collection = FROM_TABLE[payload.table];
          if (!collection) return;
          pending.add(collection);
          clearTimeout(timer);
          timer = setTimeout(() => {
            pending.forEach(listener);
            pending.clear();
          }, 250);
        })
        .subscribe();
      return () => {
        clearTimeout(timer);
        void supabase.removeChannel(channel);
      };
    },
  };
}

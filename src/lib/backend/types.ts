import type { CollectionName, Collections, Role } from '@/lib/db/types';

export type FilterValue = string | number | boolean | null | string[];
/** Equality match on every key; an array means "any of these values". */
export type Filter<T> = Partial<Record<keyof T & string, FilterValue>>;

export type SignInMethod = 'local' | 'ldap';

export interface AuthOptions {
  local: boolean;
  ldap: boolean;
  signUp: boolean;
}

export interface LdapSettings {
  url: string;
  startTls: boolean;
  allowSelfSigned: boolean;
  bindDn: string;
  /** Write-only: empty keeps the saved password. */
  bindPassword: string;
  hasBindPassword: boolean;
  baseDn: string;
  userFilter: string;
  nameAttribute: string;
  emailAttribute: string;
  governorGroups: string[];
  delegateGroups: string[];
}

export interface AuthSettings {
  localEnabled: boolean;
  signUpEnabled: boolean;
  ldapEnabled: boolean;
  ldap: LdapSettings;
}

export interface LdapTestResult {
  name: string;
  email: string;
  role: Role;
  groups: string[];
}

export interface NewUser {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface Backend {
  kind: 'cloud' | 'local';
  list<C extends CollectionName>(collection: C, filter?: Filter<Collections[C]>): Promise<Collections[C][]>;
  insert<C extends CollectionName>(collection: C, rows: Record<string, unknown>[]): Promise<Collections[C][]>;
  update<C extends CollectionName>(collection: C, id: string, patch: Record<string, unknown>): Promise<Collections[C]>;
  /** Returns how many rows were removed; rows the user may not delete are left alone. */
  remove<C extends CollectionName>(collection: C, filter: Filter<Collections[C]>): Promise<number>;

  currentUserId(): Promise<string | null>;
  authOptions(): Promise<AuthOptions>;
  signIn(method: SignInMethod, identifier: string, password: string): Promise<void>;
  /** confirmEmail is true when the account exists but the person must click the emailed link before signing in. */
  signUp(name: string, email: string, password: string): Promise<{ confirmEmail: boolean }>;
  signOut(): Promise<void>;
  onAuthChange(listener: () => void): () => void;

  adminCreateUser(user: NewUser): Promise<void>;
  adminUpdateUser(userId: string, role: Role, disabled: boolean): Promise<void>;
  getAuthSettings(): Promise<AuthSettings>;
  saveAuthSettings(settings: AuthSettings): Promise<void>;
  testLdap(settings: AuthSettings, username: string, password: string): Promise<LdapTestResult>;

  /** Headers that prove who is calling our own /api endpoints (the AI assistant). */
  apiHeaders(): Promise<Record<string, string>>;
  /** Live updates: calls back with the collection whenever someone else changes data. Returns a stop function. */
  watch(listener: (collection: CollectionName) => void): () => void;
}

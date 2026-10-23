import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COLLECTIONS = [
  'profiles',
  'projects',
  'projectMembers',
  'statuses',
  'tasks',
  'checklistItems',
  'comments',
  'taskHistory',
];

const APP_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const DATA_DIR = resolve(process.env.DATA_DIR || join(APP_ROOT, 'data'));
const FILE = join(DATA_DIR, 'workday.json');

export function defaultSettings() {
  return {
    localEnabled: true,
    signUpEnabled: true,
    ldapEnabled: false,
    ldap: {
      url: '',
      startTls: false,
      allowSelfSigned: false,
      bindDn: '',
      bindPassword: '',
      baseDn: '',
      userFilter: '(|(uid={{username}})(sAMAccountName={{username}})(mail={{username}}))',
      nameAttribute: 'displayName',
      emailAttribute: 'mail',
      governorGroups: [],
      delegateGroups: [],
    },
  };
}

function emptyData() {
  return {
    version: 1,
    collections: Object.fromEntries(COLLECTIONS.map((name) => [name, []])),
    credentials: [],
    sessions: {},
    settings: defaultSettings(),
  };
}

const LEGACY_ROLES = { admin: 'governor', user: 'reporter' };

function normalize(raw) {
  const data = emptyData();
  if (typeof raw !== 'object' || raw === null) return data;
  for (const name of COLLECTIONS) {
    if (Array.isArray(raw.collections?.[name])) data.collections[name] = raw.collections[name];
  }
  for (const profile of data.collections.profiles) {
    if (LEGACY_ROLES[profile.role]) profile.role = LEGACY_ROLES[profile.role];
  }
  if (Array.isArray(raw.credentials)) data.credentials = raw.credentials;
  if (typeof raw.sessions === 'object' && raw.sessions !== null) data.sessions = raw.sessions;
  const settings = raw.settings ?? {};
  const { adminGroups, ...savedLdap } = settings.ldap ?? {};
  data.settings = { ...data.settings, ...settings, ldap: { ...data.settings.ldap, ...savedLdap } };
  if (Array.isArray(adminGroups) && !savedLdap.governorGroups) data.settings.ldap.governorGroups = adminGroups;
  return data;
}

/** Everything lives in one JSON file, rewritten atomically after each change. */
export async function openStore() {
  await mkdir(DATA_DIR, { recursive: true });
  let data;
  try {
    data = normalize(JSON.parse(await readFile(FILE, 'utf8')));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new Error(`Could not read ${FILE}: ${error.message}. Fix or move the file and start again.`);
    }
    data = emptyData();
  }

  let queue = Promise.resolve();
  const save = () => {
    const snapshot = JSON.stringify(data);
    queue = queue
      .then(async () => {
        const tmp = `${FILE}.tmp`;
        await writeFile(tmp, snapshot, { mode: 0o600 });
        await rename(tmp, FILE);
      })
      .catch((error) => console.error('Could not save Workday data:', error.message));
    return queue;
  };

  await save();
  return { data, save, file: FILE };
}

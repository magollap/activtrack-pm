import {
  HttpError,
  checkRateLimit,
  createSession,
  endSession,
  endUserSessions,
  hashPassword,
  recordFailure,
  sessionCookie,
  sessionUser,
  verifyPassword,
} from './auth.mjs';
import { groupsMapped, ldapAuthenticate, roleFromGroups } from './ldap.mjs';
import { COLLECTIONS, defaultSettings } from './store.mjs';
import {
  changeUser,
  checkFilter,
  createAccount,
  createContext,
  insertRows,
  listRows,
  removeRows,
  ROLES,
  updateRow,
  wouldKeepAGovernor,
} from './rules.mjs';

const MAX_BODY = 1024 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  if (!(req.headers['content-type'] ?? '').startsWith('application/json')) {
    throw new HttpError(415, 'Requests must be sent as JSON.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'This request is too large.');
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new HttpError(400, 'The request could not be read.');
  }
}

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const clientIp = (req) => req.socket.remoteAddress ?? 'unknown';

function publicSettings(settings) {
  return { ...settings, ldap: { ...settings.ldap, bindPassword: '', hasBindPassword: Boolean(settings.ldap.bindPassword) } };
}

const groupList = (value) =>
  (Array.isArray(value) ? value : [])
    .map((g) => text(g, 500))
    .filter(Boolean)
    .slice(0, 50);

/** Validates governor-submitted settings; an empty bind password keeps the saved one. */
function cleanSettings(input, saved) {
  if (typeof input !== 'object' || input === null) throw new HttpError(400, 'Invalid settings.');
  const ldapIn = typeof input.ldap === 'object' && input.ldap !== null ? input.ldap : {};
  const defaults = defaultSettings().ldap;
  const ldap = {
    url: text(ldapIn.url, 500),
    startTls: ldapIn.startTls === true,
    allowSelfSigned: ldapIn.allowSelfSigned === true,
    bindDn: text(ldapIn.bindDn, 500),
    bindPassword: typeof ldapIn.bindPassword === 'string' && ldapIn.bindPassword ? ldapIn.bindPassword.slice(0, 500) : saved.ldap.bindPassword,
    baseDn: text(ldapIn.baseDn, 500),
    userFilter: text(ldapIn.userFilter, 1000) || defaults.userFilter,
    nameAttribute: text(ldapIn.nameAttribute, 100) || defaults.nameAttribute,
    emailAttribute: text(ldapIn.emailAttribute, 100) || defaults.emailAttribute,
    governorGroups: groupList(ldapIn.governorGroups),
    delegateGroups: groupList(ldapIn.delegateGroups),
  };
  const settings = {
    localEnabled: input.localEnabled === true,
    signUpEnabled: input.signUpEnabled === true,
    ldapEnabled: input.ldapEnabled === true,
    ldap,
  };
  if (!settings.localEnabled && !settings.ldapEnabled) throw new HttpError(400, 'Keep at least one sign-in method turned on.');
  if (ldap.url && !/^ldaps?:\/\/[^\s]+$/i.test(ldap.url)) throw new HttpError(400, 'The server address must start with ldap:// or ldaps://.');
  if (!ldap.userFilter.includes('{{username}}')) throw new HttpError(400, 'The user filter must contain {{username}}.');
  if (settings.ldapEnabled && (!ldap.url || !ldap.baseDn)) {
    throw new HttpError(400, 'Enter the directory server address and search base before turning on LDAP sign-in.');
  }
  return settings;
}

function startSession(store, req, userId) {
  const token = createSession(store, userId);
  return { 'Set-Cookie': sessionCookie(req, token) };
}

async function createLocalAccount(store, body, role) {
  const name = text(body.name, 80);
  const email = text(body.email, 200).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!name) throw new HttpError(400, 'Please enter a name.');
  if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, 'Please enter a valid email address.');
  if (password.length < 8 || password.length > 200) throw new HttpError(400, 'Passwords must be 8 to 200 characters.');
  if (store.data.credentials.some((c) => c.type === 'local' && c.email === email)) {
    throw new HttpError(409, 'An account with this email already exists.');
  }
  const passwordHash = await hashPassword(password);
  const profile = createAccount(store, { name, email, authSource: 'local', role });
  store.data.credentials.push({ userId: profile.id, type: 'local', email, passwordHash });
  return profile;
}

async function signUp(store, req, body) {
  const { settings, collections } = store.data;
  const firstAccount = collections.profiles.length === 0;
  if (!firstAccount && (!settings.localEnabled || !settings.signUpEnabled)) {
    throw new HttpError(403, 'New sign-ups are turned off. Ask a governor for access.');
  }
  const profile = await createLocalAccount(store, body, 'reporter');
  return startSession(store, req, profile.id);
}

async function signInLocal(store, req, identifier, password) {
  const email = identifier.toLowerCase();
  const credential = store.data.credentials.find((c) => c.type === 'local' && c.email === email);
  const valid = await verifyPassword(password, credential?.passwordHash);
  if (!valid) {
    recordFailure(clientIp(req), email);
    throw new HttpError(401, 'That email and password do not match an account.');
  }
  const profile = store.data.collections.profiles.find((p) => p.id === credential.userId);
  if (!profile) throw new HttpError(401, 'That email and password do not match an account.');
  // Governors can always use their Workday password, so a directory outage never locks everyone out.
  if (!store.data.settings.localEnabled && profile.role !== 'governor') {
    throw new HttpError(403, 'Password sign-in is turned off. Use your directory (LDAP) account.');
  }
  if (profile.disabled) throw new HttpError(403, 'This account has been disabled. Contact a governor.');
  return startSession(store, req, profile.id);
}

async function signInLdap(store, req, identifier, password) {
  const { settings, collections, credentials } = store.data;
  if (!settings.ldapEnabled) throw new HttpError(403, 'Directory (LDAP) sign-in is turned off.');
  const username = identifier.toLowerCase();
  let directoryUser;
  try {
    directoryUser = await ldapAuthenticate(settings.ldap, identifier, password);
  } catch (error) {
    if (error.status === 401) recordFailure(clientIp(req), username);
    throw error;
  }

  const mapped = groupsMapped(settings.ldap);
  const role = roleFromGroups(directoryUser.groups, settings.ldap);
  let credential = credentials.find((c) => c.type === 'ldap' && c.dn.toLowerCase() === directoryUser.dn.toLowerCase());
  let profile = credential && collections.profiles.find((p) => p.id === credential.userId);

  if (!profile) {
    profile = createAccount(store, {
      name: directoryUser.name,
      email: directoryUser.email,
      authSource: 'ldap',
      role: mapped ? role : 'reporter',
    });
    credentials.push({ userId: profile.id, type: 'ldap', dn: directoryUser.dn, username });
  } else {
    if (profile.disabled) throw new HttpError(403, 'This account has been disabled. Contact a governor.');
    profile.email = directoryUser.email || profile.email;
    // The directory decides the role when role groups are configured.
    if (mapped && profile.role !== role && wouldKeepAGovernor(collections, profile, role, false)) profile.role = role;
    profile.updatedAt = new Date().toISOString();
  }
  return startSession(store, req, profile.id);
}

async function handleAuth(store, req, res, action) {
  if (action === 'options' && req.method === 'GET') {
    const { settings, collections } = store.data;
    const firstAccount = collections.profiles.length === 0;
    return send(res, 200, {
      local: settings.localEnabled || firstAccount,
      ldap: settings.ldapEnabled,
      signUp: firstAccount || (settings.localEnabled && settings.signUpEnabled),
    });
  }
  if (action === 'me' && req.method === 'GET') {
    return send(res, 200, { userId: sessionUser(store, req)?.id ?? null });
  }
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
  const body = await readJson(req);

  if (action === 'signout') {
    endSession(store, req);
    await store.save();
    return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '') });
  }
  if (action === 'signup') {
    const headers = await signUp(store, req, body);
    await store.save();
    return send(res, 200, { ok: true }, headers);
  }
  if (action === 'signin') {
    const identifier = text(body.identifier, 200);
    const password = typeof body.password === 'string' ? body.password.slice(0, 500) : '';
    if (!identifier || !password) throw new HttpError(400, 'Enter your username or email and password.');
    checkRateLimit(clientIp(req), identifier.toLowerCase());
    const headers =
      body.method === 'ldap'
        ? await signInLdap(store, req, identifier, password)
        : await signInLocal(store, req, identifier, password);
    await store.save();
    return send(res, 200, { ok: true }, headers);
  }
  throw new HttpError(404, 'Not found.');
}

async function handleAdmin(store, req, res, me, action) {
  if (me.role !== 'governor') throw new HttpError(403, 'Only governors can do that.');
  if (action === 'auth-settings' && req.method === 'GET') {
    return send(res, 200, { settings: publicSettings(store.data.settings) });
  }
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
  const body = await readJson(req);

  if (action === 'auth-settings') {
    store.data.settings = cleanSettings(body.settings, store.data.settings);
    await store.save();
    return send(res, 200, { ok: true });
  }
  if (action === 'ldap-test') {
    const settings = cleanSettings({ ...body.settings, ldapEnabled: false, localEnabled: true }, store.data.settings);
    const username = text(body.username, 200);
    const password = typeof body.password === 'string' ? body.password.slice(0, 500) : '';
    const user = await ldapAuthenticate(settings.ldap, username, password);
    const role = roleFromGroups(user.groups, settings.ldap);
    return send(res, 200, { result: { name: user.name, email: user.email, role, groups: user.groups } });
  }
  if (action === 'users/create') {
    if (!ROLES.includes(body.role)) throw new HttpError(400, 'Choose a role.');
    const profile = await createLocalAccount(store, body, body.role);
    await store.save();
    return send(res, 200, { id: profile.id });
  }
  if (action === 'users/update') {
    const target = changeUser(store, me, body.userId, body.role, body.disabled);
    if (target.disabled) endUserSessions(store, target.id);
    await store.save();
    return send(res, 200, { ok: true });
  }
  throw new HttpError(404, 'Not found.');
}

async function handleData(store, req, res, me, collection, action) {
  if (req.method !== 'POST' || !COLLECTIONS.includes(collection)) throw new HttpError(404, 'Not found.');
  const body = await readJson(req);
  const ctx = createContext(store, me);

  if (action === 'list') return send(res, 200, { rows: listRows(ctx, collection, checkFilter(body.filter ?? {})) });
  if (action === 'insert') {
    const rows = insertRows(ctx, collection, body.rows);
    await store.save();
    return send(res, 200, { rows });
  }
  if (action === 'update') {
    if (typeof body.id !== 'string') throw new HttpError(400, 'Invalid request.');
    const row = updateRow(ctx, collection, body.id, body.patch);
    await store.save();
    return send(res, 200, { row });
  }
  if (action === 'remove') {
    const filter = checkFilter(body.filter ?? {});
    if (!Object.keys(filter).length) throw new HttpError(400, 'Choose what to delete.');
    const removed = removeRows(ctx, collection, filter);
    if (removed) await store.save();
    return send(res, 200, { removed });
  }
  throw new HttpError(404, 'Not found.');
}

/** Routes everything under /api. Writes need a custom header, which cross-site forms cannot send. */
export async function handleApi(store, req, res, path) {
  try {
    if (path === '/api/health') return send(res, 200, { app: 'workday', ok: true });
    if (req.method === 'POST' && req.headers['x-workday'] !== '1') throw new HttpError(403, 'Request blocked.');

    const [, , area, ...rest] = path.split('/');
    if (area === 'auth') return await handleAuth(store, req, res, rest.join('/'));

    const me = sessionUser(store, req);
    if (!me) throw new HttpError(401, 'Your session has ended. Please sign in again.');
    if (area === 'admin') return await handleAdmin(store, req, res, me, rest.join('/'));
    if (area === 'data' && rest.length === 2) return await handleData(store, req, res, me, rest[0], rest[1]);
    throw new HttpError(404, 'Not found.');
  } catch (error) {
    if (error instanceof HttpError) return send(res, error.status, { error: error.message });
    console.error(error);
    return send(res, 500, { error: 'Something went wrong on the server.' });
  }
}

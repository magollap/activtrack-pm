import { Client, InvalidCredentialsError } from 'ldapts';
import { HttpError } from './auth.mjs';

/** RFC 4515 escaping so a username can never change the meaning of the search filter. */
export function escapeFilterValue(value) {
  return value.replace(/[\\*()\0]/g, (c) => `\\${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

const first = (value) => (Array.isArray(value) ? value[0] : value);
const asStrings = (value) =>
  (Array.isArray(value) ? value : value === undefined ? [] : [value]).map((v) => String(v)).filter(Boolean);

const groupName = (dn) => /^[^=]+=([^,]+)/.exec(dn)?.[1] ?? dn;

function inAnyGroup(groups, configured) {
  const wanted = configured.map((g) => g.trim().toLowerCase()).filter(Boolean);
  return groups.some((dn) => {
    const lower = dn.toLowerCase();
    return wanted.includes(lower) || wanted.includes(groupName(lower));
  });
}

export const groupsMapped = (ldap) => ldap.governorGroups.length > 0 || ldap.delegateGroups.length > 0;

export function roleFromGroups(groups, ldap) {
  if (inAnyGroup(groups, ldap.governorGroups)) return 'governor';
  if (inAnyGroup(groups, ldap.delegateGroups)) return 'delegate';
  return 'reporter';
}

function unreachable(error) {
  console.error('LDAP error:', error.message);
  return new HttpError(
    503,
    'The directory (LDAP) server could not be reached. Governors can still sign in with an ActivTrack password.',
  );
}

const invalid = () => new HttpError(401, 'That username and password do not match a directory account.');

/** Finds the user with the service account, then proves the password by binding as them. */
export async function ldapAuthenticate(config, username, password) {
  if (!config.url || !config.baseDn) throw new HttpError(503, 'Directory (LDAP) sign-in has not been set up yet.');
  // An empty password is an "unauthenticated bind" that many servers accept, so it must never reach the server.
  if (!username || !password) throw invalid();

  const tlsOptions = { rejectUnauthorized: !config.allowSelfSigned };
  const client = new Client({ url: config.url, timeout: 8000, connectTimeout: 8000, tlsOptions });
  const nameAttr = config.nameAttribute || 'displayName';
  const emailAttr = config.emailAttribute || 'mail';

  try {
    if (config.startTls) await client.startTLS(tlsOptions);
    if (config.bindDn) await client.bind(config.bindDn, config.bindPassword);

    const filter = config.userFilter.replaceAll('{{username}}', escapeFilterValue(username));
    let entries;
    try {
      ({ searchEntries: entries } = await client.search(config.baseDn, {
        scope: 'sub',
        filter,
        sizeLimit: 2,
        attributes: [nameAttr, emailAttr, 'cn', 'memberOf'],
      }));
    } catch (error) {
      if (error.name === 'SizeLimitExceededError') throw invalid();
      throw error;
    }
    if (entries.length !== 1) throw invalid();
    const entry = entries[0];

    const groups = new Set(asStrings(entry.memberOf));
    const { searchEntries: groupEntries } = await client
      .search(config.baseDn, {
        scope: 'sub',
        filter: `(|(member=${escapeFilterValue(entry.dn)})(uniqueMember=${escapeFilterValue(entry.dn)})(memberUid=${escapeFilterValue(username)}))`,
        attributes: ['cn'],
        sizeLimit: 500,
      })
      .catch(() => ({ searchEntries: [] }));
    groupEntries.forEach((g) => groups.add(g.dn));

    try {
      await client.bind(entry.dn, password);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) throw invalid();
      throw error;
    }

    const name = String(first(entry[nameAttr]) || first(entry.cn) || username).slice(0, 80);
    const email = String(first(entry[emailAttr]) || '').toLowerCase().slice(0, 200);
    return { dn: entry.dn, name, email, groups: [...groups] };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof InvalidCredentialsError) {
      throw new HttpError(503, 'The directory service account was rejected. Check the bind DN and password.');
    }
    throw unreachable(error);
  } finally {
    await client.unbind().catch(() => {});
  }
}

import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SESSION_DAYS = 30;
export const SESSION_COOKIE = 'workday_session';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

const DUMMY_HASH = `scrypt$${randomBytes(16).toString('base64')}$${randomBytes(KEY_LENGTH).toString('base64')}`;

/** Always does the full hash so response time does not reveal whether an account exists. */
export async function verifyPassword(password, stored) {
  const [scheme, salt, expected] = (stored || DUMMY_HASH).split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), KEY_LENGTH);
  const wanted = Buffer.from(expected, 'base64');
  return Boolean(stored) && wanted.length === actual.length && timingSafeEqual(wanted, actual);
}

const tokenKey = (token) => createHash('sha256').update(token).digest('hex');

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    try {
      cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      // Ignore malformed cookies.
    }
  }
  return cookies;
}

function isSecure(req) {
  return process.env.COOKIE_SECURE === '1' || req.headers['x-forwarded-proto'] === 'https';
}

export function sessionCookie(req, token) {
  const parts = [`${SESSION_COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  parts.push(token ? `Max-Age=${SESSION_DAYS * 86400}` : 'Max-Age=0');
  if (isSecure(req)) parts.push('Secure');
  return parts.join('; ');
}

export function createSession(store, userId) {
  const token = randomBytes(32).toString('base64url');
  store.data.sessions[tokenKey(token)] = { userId, expiresAt: Date.now() + SESSION_DAYS * 86400_000 };
  return token;
}

export function endSession(store, req) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) delete store.data.sessions[tokenKey(token)];
}

export function endUserSessions(store, userId) {
  for (const [key, session] of Object.entries(store.data.sessions)) {
    if (session.userId === userId) delete store.data.sessions[key];
  }
}

export function pruneSessions(store) {
  const now = Date.now();
  for (const [key, session] of Object.entries(store.data.sessions)) {
    if (session.expiresAt < now) delete store.data.sessions[key];
  }
}

/** The signed-in, active profile for this request, or null. */
export function sessionUser(store, req) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const session = store.data.sessions[tokenKey(token)];
  if (!session || session.expiresAt < Date.now()) return null;
  const profile = store.data.collections.profiles.find((p) => p.id === session.userId);
  return profile && !profile.disabled ? profile : null;
}

const WINDOW_MS = 15 * 60_000;
const attempts = new Map();

function hit(key, limit) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

/** Counts failed sign-ins per address and per address+account. */
export function checkRateLimit(ip, identifier) {
  const now = Date.now();
  const blocked = [`${ip}`, `${ip}:${identifier}`].some((key) => {
    const entry = attempts.get(key);
    return entry && entry.resetAt > now && entry.count >= (key === ip ? 50 : 10);
  });
  if (blocked) throw new HttpError(429, 'Too many sign-in attempts. Please wait 15 minutes and try again.');
}

export function recordFailure(ip, identifier) {
  hit(`${ip}`, 50);
  hit(`${ip}:${identifier}`, 10);
}

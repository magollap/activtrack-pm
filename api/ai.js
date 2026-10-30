// Vercel serverless function for the AI assistant: POST /api/ai plans board actions, GET /api/ai reports
// whether AI is configured. Requests must carry the signed-in person's Supabase access token, so the AI key
// on this server can only be used by people with an account in your database.
import { AiError, aiConfig, checkAiRateLimit, planActions } from '../server/ai.mjs';

const MAX_BODY = 256 * 1024;

function send(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(status).send(JSON.stringify(body));
}

/** Confirms the bearer token belongs to a real, signed-in Supabase user and returns their id. */
async function supabaseUser(req) {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new AiError(500, 'The database connection is not configured on the server.');
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new AiError(401, 'Please sign in again.');
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new AiError(401, 'Your session has ended. Please sign in again.');
  const user = await response.json().catch(() => null);
  if (!user?.id) throw new AiError(401, 'Your session has ended. Please sign in again.');
  return user.id;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const config = aiConfig();
      return send(res, 200, { enabled: Boolean(config), provider: config?.label ?? null });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return send(res, 405, { error: 'Method not allowed.' });
    }
    if (!aiConfig()) throw new AiError(501, 'AI is not configured on this server.');
    const userId = await supabaseUser(req);
    checkAiRateLimit(userId);

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
    if (JSON.stringify(body ?? {}).length > MAX_BODY) throw new AiError(413, 'This request is too large.');
    return send(res, 200, await planActions(body));
  } catch (error) {
    if (error instanceof AiError) return send(res, error.status, { error: error.message });
    if (error instanceof SyntaxError) return send(res, 400, { error: 'The request could not be read.' });
    console.error(error);
    return send(res, 500, { error: 'Something went wrong on the server.' });
  }
}

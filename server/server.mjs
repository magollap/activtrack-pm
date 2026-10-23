import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { handleApi } from './api.mjs';
import { pruneSessions } from './auth.mjs';
import { openStore } from './store.mjs';

const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt']);
const NO_CACHE = new Set(['/index.html', '/sw.js', '/registerSW.js', '/manifest.webmanifest']);

async function findFile(urlPath) {
  const filePath = normalize(join(ROOT, urlPath));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) return null;
  try {
    const info = await stat(filePath);
    if (info.isFile()) return filePath;
    if (info.isDirectory()) return findFile(join(urlPath, 'index.html'));
  } catch {
    return null;
  }
  return null;
}

function cacheHeader(urlPath) {
  if (urlPath.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  if (NO_CACHE.has(urlPath)) return 'no-cache';
  return 'public, max-age=3600';
}

const store = await openStore().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
setInterval(() => pruneSessions(store), 3600_000).unref();

const server = createServer(async (req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  if (urlPath === '/api' || urlPath.startsWith('/api/')) {
    await handleApi(store, req, res, urlPath);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let filePath = await findFile(urlPath);
  let servedPath = urlPath;
  if (!filePath) {
    if (extname(urlPath) && !urlPath.endsWith('.html')) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    filePath = join(ROOT, 'index.html');
    servedPath = '/index.html';
  }
  if (filePath.endsWith(`${sep}index.html`)) servedPath = '/index.html';

  const ext = extname(filePath).toLowerCase();
  const gzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  const headers = {
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    'Cache-Control': cacheHeader(servedPath),
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Accept-Encoding',
  };
  if (gzip) headers['Content-Encoding'] = 'gzip';

  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const stream = createReadStream(filePath);
  stream.on('error', () => res.destroy());
  (gzip ? stream.pipe(createGzip()) : stream).pipe(res);
});

stat(join(ROOT, 'index.html'))
  .then(() => {
    server.listen(PORT, HOST, () => {
      const shown = HOST === '0.0.0.0' ? 'localhost' : HOST;
      console.log(`Workday is running at http://${shown}:${PORT}`);
      console.log(`Data is stored in ${store.file}`);
    });
  })
  .catch(() => {
    console.error('Could not find dist/index.html. Run "npm run build" first.');
    process.exit(1);
  });

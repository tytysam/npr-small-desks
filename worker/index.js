import { DurableObject } from 'cloudflare:workers';
import { parseHeartRequest, json } from './hearts.js';

/**
 * The site's Worker. Static assets (the Vite build) are served by Cloudflare
 * directly; only /api/* runs this script (`run_worker_first` in
 * wrangler.jsonc).
 *
 * Hearts: one global Durable Object holds every visitor's hearts in SQLite.
 * Visitors are anonymous ids from the browser's localStorage, so this is
 * honour-system counting; a per-IP rate limit keeps it from being flooded.
 */

const COUNTS_TTL_S = 30;

// The lineup's video ids, read once per isolate from the deployed
// channels.json, so only real concerts can be hearted.
let lineup = null;
const knownVideos = (env, request) => {
  lineup ??= env.ASSETS.fetch(new URL('/channels.json', request.url))
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`channels.json: ${r.status}`))))
    .then(({ channels }) => new Set(channels.map((c) => c.id)))
    .catch((error) => {
      lineup = null; // try again next request
      throw error;
    });
  return lineup;
};

const room = (env) => env.HEARTS.get(env.HEARTS.idFromName('global'));

// GET /api/hearts is cached at the edge for a short while, so opening the
// guide doesn't always reach the Durable Object. Browsers don't cache it.
const countsCacheKey = (request) => new Request(new URL('/api/hearts', request.url));

const getCounts = async (request, env, ctx) => {
  const cache = caches.default;
  const key = countsCacheKey(request);
  const cached = await cache.match(key);
  if (cached) return json(await cached.json());

  const body = { counts: await room(env).counts() };
  ctx.waitUntil(cache.put(key, json(body, { headers: { 'Cache-Control': `public, max-age=${COUNTS_TTL_S}` } })));
  return json(body);
};

const setHeart = async ({ video, visitor, on }, request, env, ctx) => {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  const { success } = await env.HEART_LIMIT.limit({ key: ip });
  if (!success) return json({ error: 'slow down' }, { status: 429 });

  let known;
  try {
    known = await knownVideos(env, request);
  } catch {
    return json({ error: 'lineup unavailable' }, { status: 503 });
  }
  if (!known.has(video)) return json({ error: 'unknown video' }, { status: 400 });

  const count = await room(env).heart(visitor, video, on);
  // This colo's cached counts are now stale; other colos catch up within the TTL.
  ctx.waitUntil(caches.default.delete(countsCacheKey(request)));
  return json({ id: video, count });
};

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/api/hearts')) return json({ error: 'not found' }, { status: 404 });

    const parsed = parseHeartRequest(request);
    if (parsed.kind === 'error') return json({ error: parsed.error }, { status: parsed.status });
    if (parsed.kind === 'counts') return getCounts(request, env, ctx);
    return setHeart(parsed, request, env, ctx);
  },
};

/** Every visitor's hearts: one row per (visitor, concert). */
export class Hearts extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS hearts (
        visitor TEXT NOT NULL,
        video   TEXT NOT NULL,
        at      INTEGER NOT NULL,
        PRIMARY KEY (visitor, video)
      );
      CREATE INDEX IF NOT EXISTS hearts_by_video ON hearts (video);
    `);
    this.countsCache = null;
  }

  /** Hearts or un-hearts; idempotent. Returns the concert's new count. */
  heart(visitor, video, on) {
    if (on) this.sql.exec('INSERT OR IGNORE INTO hearts (visitor, video, at) VALUES (?, ?, ?)', visitor, video, Date.now());
    else this.sql.exec('DELETE FROM hearts WHERE visitor = ? AND video = ?', visitor, video);
    this.countsCache = null;
    return this.sql.exec('SELECT COUNT(*) AS n FROM hearts WHERE video = ?', video).one().n;
  }

  /** { [videoId]: count } for every concert with at least one heart. */
  counts() {
    this.countsCache ??= Object.fromEntries(
      this.sql
        .exec('SELECT video, COUNT(*) AS n FROM hearts GROUP BY video')
        .toArray()
        .map((row) => [row.video, row.n])
    );
    return this.countsCache;
  }
}

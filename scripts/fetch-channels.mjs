#!/usr/bin/env node
/**
 * Builds public/channels.json: every embeddable Tiny Desk video on NPR Music's
 * channel, with a clean title, parsed artist name and duration.
 *
 * Runs before `npm run build` and via `npm run channels`. The YouTube key stays
 * on this machine — the app only ever fetches the static JSON. Without a key
 * the existing file is kept, so builds work anywhere once it's committed.
 *
 * Quota: playlistItems.list and videos.list cost 1 unit per 50 videos each,
 * versus 100 units for every search.list the app used to make per visit. To
 * keep routine runs to a unit or two:
 *
 * - Skipped if the list was checked in the last day (`--force` to run anyway).
 * - Incremental: uploads come newest first, so paging stops at the first
 *   video already in channels.json, and only new videos get looked up.
 * - A full sweep (every upload, every video re-checked, which drops ones that
 *   were deleted or made unembeddable) runs weekly, or with `--full`.
 *
 * When it last checked / swept is kept in node_modules/.cache, not in
 * channels.json, so a run that finds nothing new leaves the file untouched.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'channels.json');
const NPR_MUSIC_CHANNEL = 'UC4eYXhJI4-7wSWc8UNRwD4A';
const UPLOADS_PLAYLIST = `UU${NPR_MUSIC_CHANNEL.slice(2)}`;
const MAX_PAGES = 200; // 10,000 uploads; NPR Music has a few thousand
const MIN_SECONDS = 120; // drop Shorts and trailers
const CACHE = join(ROOT, 'node_modules', '.cache', 'fetch-channels.json');
const FRESH_MS = 24 * 60 * 60 * 1000;
const FULL_SWEEP_MS = 7 * 24 * 60 * 60 * 1000;

const args = new Set(process.argv.slice(2));

const API = 'https://www.googleapis.com/youtube/v3';

const readKey = () => {
  if (process.env.YOUTUBE_API_KEY) return process.env.YOUTUBE_API_KEY;
  const envFile = join(ROOT, '.env');
  if (!existsSync(envFile)) return null;
  const vars = Object.fromEntries(
    readFileSync(envFile, 'utf8')
      .split('\n')
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map(([, k, v]) => [k, v.replace(/^['"]|['"]$/g, '')])
  );
  return vars.YOUTUBE_API_KEY || vars.REACT_APP_YOUTUBE_API_KEY || null;
};

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decodeEntities = (text) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });

// "Artist: Tiny Desk Concert" / "Artist | Tiny Desk (Home) Concert" → "Artist"
export const parseArtistName = (title) => {
  for (const sep of [':', '|']) {
    if (title.includes(sep)) return title.split(sep)[0].trim();
  }
  return title;
};

// ISO 8601 duration (PT1H2M3S) → seconds
const parseDuration = (iso) => {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return 0;
  const [, d = 0, h = 0, min = 0, s = 0] = m.map((v) => (v === undefined ? 0 : Number(v)));
  return d * 86400 + h * 3600 + min * 60 + s;
};

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

let unitsUsed = 0;
const get = async (path, params) => {
  unitsUsed += 1; // playlistItems.list and videos.list are 1 unit per call
  const url = new URL(`${API}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`${path}: ${res.status} ${body.error?.message ?? res.statusText}`);
  }
  return res.json();
};

const isTinyDesk = (title) => /tiny desk/i.test(title) && !/trailer|teaser|preview|announc/i.test(title);

const main = async () => {
  const key = readKey();
  if (!key) {
    const note = existsSync(OUT) ? 'keeping the existing public/channels.json' : 'public/channels.json does not exist yet';
    console.warn(`[channels] No YOUTUBE_API_KEY found; ${note}.`);
    return;
  }

  const existing = readJson(OUT)?.channels ?? [];
  const cache = readJson(CACHE) ?? {};
  const now = Date.now();
  // Without a cache (fresh clone, CI), the file's own date stands in for the last check.
  const lastChecked = Date.parse(cache.checkedAt ?? readJson(OUT)?.generatedAt ?? 0) || 0;
  const lastSwept = Date.parse(cache.sweptAt ?? 0) || 0;
  const full = args.has('--full') || existing.length === 0 || (cache.sweptAt && now - lastSwept > FULL_SWEEP_MS);

  if (!full && !args.has('--force') && now - lastChecked < FRESH_MS) {
    console.log('[channels] Checked within the last day; skipping (npm run channels -- --force to refresh).');
    return;
  }

  const known = new Map(existing.map((c) => [c.id, c]));

  // 1. Uploads' ids + titles, newest first: all of them on a full sweep,
  // otherwise only those newer than the newest video we already have.
  const candidates = [];
  let pageToken = '';
  let reachedKnown = false;
  for (let page = 0; page < MAX_PAGES && !reachedKnown; page += 1) {
    const data = await get('playlistItems', {
      part: 'snippet',
      playlistId: UPLOADS_PLAYLIST,
      maxResults: 50,
      key,
      ...(pageToken && { pageToken }),
    });
    data.items.forEach(({ snippet }) => {
      if (reachedKnown) return;
      if (!full && known.has(snippet.resourceId.videoId)) {
        reachedKnown = true;
        return;
      }
      const title = decodeEntities(snippet.title);
      if (isTinyDesk(title)) {
        candidates.push({ id: snippet.resourceId.videoId, title, publishedAt: snippet.publishedAt });
      }
    });
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  // 2. Durations and embeddability, 50 at a time.
  const details = new Map();
  for (let i = 0; i < candidates.length; i += 50) {
    const ids = candidates.slice(i, i + 50).map((c) => c.id);
    const data = await get('videos', { part: 'contentDetails,status', id: ids.join(','), key });
    data.items.forEach((v) =>
      details.set(v.id, {
        duration: parseDuration(v.contentDetails.duration),
        playable: v.status.embeddable && v.status.privacyStatus === 'public',
      })
    );
  }

  const found = candidates
    .map((c) => ({ ...c, ...details.get(c.id) }))
    .filter((c) => c.playable && c.duration >= MIN_SECONDS)
    .map(({ id, title, publishedAt, duration }) => ({
      id,
      title,
      artist: parseArtistName(title),
      publishedAt: publishedAt.slice(0, 10),
      duration,
    }));
  // Incremental: the new videos go on top of the ones we already had.
  const channels = full ? found : [...found, ...existing];

  if (channels.length === 0) throw new Error('No playable Tiny Desk videos found; not overwriting channels.json.');

  const stamp = new Date(now).toISOString();
  mkdirSync(dirname(CACHE), { recursive: true });
  // Never swept on this machine yet? Start the weekly clock now.
  writeFileSync(CACHE, JSON.stringify({ checkedAt: stamp, sweptAt: full ? stamp : cache.sweptAt ?? stamp }) + '\n');

  const unchanged = channels.length === existing.length && channels.every((c, i) => JSON.stringify(c) === JSON.stringify(existing[i]));
  const how = `${full ? 'full sweep' : 'incremental'}, ${unitsUsed} quota ${unitsUsed === 1 ? 'unit' : 'units'}`;
  if (unchanged) {
    console.log(`[channels] No changes (${how}); public/channels.json left as is.`);
    return;
  }
  writeFileSync(OUT, JSON.stringify({ generatedAt: stamp, channels }, null, 0) + '\n');
  const added = full ? channels.length - existing.length : found.length;
  console.log(`[channels] Wrote ${channels.length} videos (${added >= 0 ? '+' : ''}${added}) to public/channels.json (${how}).`);
};

main().catch((err) => {
  console.error(`[channels] ${err.message}`);
  // A failed refresh shouldn't block a build that already has data to ship.
  process.exit(existsSync(OUT) ? 0 : 1);
});

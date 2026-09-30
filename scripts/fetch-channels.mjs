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
 * versus 100 units for every search.list the app used to make per visit.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'channels.json');
const NPR_MUSIC_CHANNEL = 'UC4eYXhJI4-7wSWc8UNRwD4A';
const UPLOADS_PLAYLIST = `UU${NPR_MUSIC_CHANNEL.slice(2)}`;
const MAX_PAGES = 200; // 10,000 uploads; NPR Music has a few thousand
const MIN_SECONDS = 120; // drop Shorts and trailers

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

const get = async (path, params) => {
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

  // 1. Every upload's id + title (newest first).
  const candidates = [];
  let pageToken = '';
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = await get('playlistItems', {
      part: 'snippet',
      playlistId: UPLOADS_PLAYLIST,
      maxResults: 50,
      key,
      ...(pageToken && { pageToken }),
    });
    data.items.forEach(({ snippet }) => {
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

  const channels = candidates
    .map((c) => ({ ...c, ...details.get(c.id) }))
    .filter((c) => c.playable && c.duration >= MIN_SECONDS)
    .map(({ id, title, publishedAt, duration }) => ({
      id,
      title,
      artist: parseArtistName(title),
      publishedAt: publishedAt.slice(0, 10),
      duration,
    }));

  if (channels.length === 0) throw new Error('No playable Tiny Desk videos found; not overwriting channels.json.');

  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), channels }, null, 0) + '\n');
  console.log(`[channels] Wrote ${channels.length} videos to public/channels.json.`);
};

main().catch((err) => {
  console.error(`[channels] ${err.message}`);
  // A failed refresh shouldn't block a build that already has data to ship.
  process.exit(existsSync(OUT) ? 0 : 1);
});

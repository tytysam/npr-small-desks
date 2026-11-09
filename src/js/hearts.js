/**
 * Hearts: viewers' favourite concerts, shared through the site's Worker
 * (worker/index.js). Keyed by YouTube video id, since channel numbers shift
 * whenever a new concert joins the lineup.
 */

const API = `${import.meta.env.BASE_URL}api/hearts`;
const VISITOR_KEY = 'npr-small-desk:visitor';

const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  // Older browsers: a v4-shaped id from Math.random is plenty for this.
  'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

let fallbackVisitor = null;

/** This browser's anonymous visitor id, made on first use. */
export const visitorId = () => {
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = newId();
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    // No storage: hearts still work for this visit.
    fallbackVisitor ??= newId();
    return fallbackVisitor;
  }
};

/** { [videoId]: count } for every hearted concert. */
export const fetchHeartCounts = async () => {
  const response = await fetch(API);
  if (!response.ok) throw new Error(`hearts: ${response.status}`);
  const { counts } = await response.json();
  return counts ?? {};
};

/** Hearts (or un-hearts) a concert; resolves to its new count. */
export const putHeart = async (videoId, on) => {
  const response = await fetch(`${API}/${encodeURIComponent(videoId)}`, {
    method: on ? 'PUT' : 'DELETE',
    headers: { 'X-Visitor': visitorId() },
  });
  if (!response.ok) throw new Error(`hearts: ${response.status}`);
  const { count } = await response.json();
  return count;
};

/**
 * Lineup indices of the hearted concerts, most hearts first; ties go to the
 * newer concert (lower index: the lineup is newest first). Concerts no longer
 * in the lineup drop out.
 */
export const rankHearts = (channels, counts) =>
  channels
    .map((c, i) => [i, counts[c.id] ?? 0])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([i]) => i);

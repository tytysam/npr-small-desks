import { onAir } from './schedule';

/** Listings per printed page of the guide. */
export const PER_PAGE = 12;

export const pageOf = (index, perPage = PER_PAGE) => Math.floor(index / perPage);
export const pageCount = (count, perPage = PER_PAGE) => Math.max(1, Math.ceil(count / perPage));

/** Thumb-index tabs, one per hundred channels: { label: '101', index: 100 }. */
export const indexTabs = (count, step = 100) =>
  Array.from({ length: Math.ceil(count / step) }, (_, i) => ({ label: String(i * step + 1), index: i * step }));

/**
 * One station's entry. Live: what's on now (with start/end times and how far
 * through it is) and what's on next. VCR: the station's one concert.
 */
export const listingFor = (schedule, station, nowMs, broadcast) => {
  if (!broadcast) return { station, now: { index: station } };
  const { index, offset, remaining } = onAir(schedule, station, nowMs);
  const startMs = nowMs - offset * 1000;
  const endMs = nowMs + remaining * 1000;
  const next = onAir(schedule, station, endMs + 1);
  return {
    station,
    now: { index, startMs, endMs, progress: offset / (offset + remaining) },
    next: { index: next.index, startMs: endMs },
  };
};

const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

/** Lineup indices whose artist or title contains every word of `query`. */
export const searchChannels = (channels, query) => {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits = [];
  channels.forEach((c, i) => {
    const text = fold(`${c.artist} ${c.title}`);
    if (words.every((w) => text.includes(w))) hits.push(i);
  });
  return hits;
};

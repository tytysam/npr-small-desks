/**
 * Broadcast schedule: every station plays the whole lineup back to back, on
 * a loop, starting at a different point — station k began with video k at
 * EPOCH. What's on air is a pure function of the wall clock, so everyone
 * tuned to the same station sees the same moment without any server.
 */

// Schedules count from here. Changing it reshuffles what's on air everywhere.
export const EPOCH_MS = Date.UTC(2026, 0, 1);

/** Precomputes start offsets (seconds into the loop) for each video. */
export const makeSchedule = (channels) => {
  const starts = new Float64Array(channels.length + 1);
  channels.forEach((c, i) => {
    starts[i + 1] = starts[i] + Math.max(1, c.duration || 0);
  });
  return { starts, total: starts[channels.length], size: channels.length };
};

// Last index i with starts[i] <= t.
const videoAt = (starts, size, t) => {
  let lo = 0;
  let hi = size - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

/**
 * What `station` is airing at `nowMs`: the video's lineup index, how far
 * into it (seconds) and how long is left.
 */
export const onAir = (schedule, station, nowMs) => {
  const { starts, total, size } = schedule;
  const elapsed = (nowMs - EPOCH_MS) / 1000;
  const t = (((starts[station] + elapsed) % total) + total) % total;
  const index = videoAt(starts, size, t);
  const offset = t - starts[index];
  return { index, offset, remaining: starts[index + 1] - t };
};

/**
 * Where video `index` can be caught at `nowMs`. If a station is airing it,
 * returns that station and how far in (`offset`, seconds), preferring the one
 * that started it most recently. Otherwise returns the station that starts
 * it soonest and how long until then (`startsIn`, seconds).
 */
export const findAiring = (schedule, index, nowMs) => {
  const { starts, total, size } = schedule;
  const elapsed = (nowMs - EPOCH_MS) / 1000;
  const duration = starts[index + 1] - starts[index];
  const mod = (v) => ((v % total) + total) % total;
  // Station s is `mod(starts[s] - lower)` seconds into video `index`.
  const lower = mod(starts[index] - elapsed);
  // First station at or after `lower` (wrapping to station 0).
  let lo = 0;
  let hi = size;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] < lower) lo = mid + 1;
    else hi = mid;
  }
  const latest = lo % size;
  const offset = mod(starts[latest] - lower);
  if (offset < duration) return { station: latest, offset, onNow: true };
  const soonest = (latest - 1 + size) % size;
  return { station: soonest, startsIn: total - mod(starts[soonest] - lower), onNow: false };
};

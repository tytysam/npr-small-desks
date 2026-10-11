/**
 * Broadcast schedule: every station plays the whole lineup back to back, on
 * a loop. What's on air is a pure function of the wall clock, so everyone
 * tuned to the same station sees the same moment without any server.
 *
 * Two things keep neighbouring stations from looking alike:
 *
 * - The loop plays in a fixed shuffled order, not newest to oldest. Each
 *   concert's place is a hash of its video id, so new concerts slot in
 *   without reordering the rest.
 * - Station k joins the loop at fraction {k·φ} of the way round (φ, the
 *   golden ratio). Those points stay spread out however many stations
 *   there are, so no two stations are ever close together in the loop.
 */

// Schedules count from here. Changing it reshuffles what's on air everywhere.
export const EPOCH_MS = Date.UTC(2026, 0, 1);

const PHI = (Math.sqrt(5) - 1) / 2; // 0.618…; {k·φ} is the same as {k·1.618…}
const SALT = 'np-r1'; // changing it reshuffles the loop

// FNV-1a, 32-bit: a fast, stable string hash.
const hash = (text) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
};

/**
 * Precomputes the loop: the play order (loop position → lineup index), when
 * each position starts (seconds into the loop), and each station's starting
 * point, sorted so stations can be searched by where they are in the loop.
 */
export const makeSchedule = (channels) => {
  const size = channels.length;
  const keys = channels.map((c, i) => hash(`${SALT}:${c.id ?? i}`));
  const order = Array.from({ length: size }, (_, i) => i).sort((a, b) => keys[a] - keys[b] || a - b);
  const positionOf = new Int32Array(size);
  order.forEach((index, position) => {
    positionOf[index] = position;
  });

  const starts = new Float64Array(size + 1);
  order.forEach((index, position) => {
    starts[position + 1] = starts[position] + Math.max(1, channels[index].duration || 0);
  });
  const total = starts[size];

  const offsets = Array.from({ length: size }, (_, k) => ((k * PHI) % 1) * total);
  const byOffset = Array.from({ length: size }, (_, k) => k).sort((a, b) => offsets[a] - offsets[b]);
  return {
    size,
    total,
    starts,
    order,
    positionOf,
    offsets,
    stationsByOffset: Int32Array.from(byOffset),
    sortedOffsets: Float64Array.from(byOffset, (k) => offsets[k]),
  };
};

// Last index i in [0, n) with sorted[i] <= t, or -1.
const lastAtOrBefore = (sorted, n, t) => {
  let lo = -1;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (sorted[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

const wrap = (t, total) => ((t % total) + total) % total;

/**
 * What `station` is airing at `nowMs`: the video's lineup index, how far
 * into it (seconds) and how long is left.
 */
export const onAir = (schedule, station, nowMs) => {
  const { starts, total, size, order, offsets } = schedule;
  const t = wrap(offsets[station] + (nowMs - EPOCH_MS) / 1000, total);
  const position = Math.max(0, lastAtOrBefore(starts, size, t));
  const offset = t - starts[position];
  return { index: order[position], offset, remaining: starts[position + 1] - t };
};

/**
 * Where video `index` can be caught at `nowMs`. If a station is airing it,
 * returns that station and how far in (`offset`, seconds), preferring the one
 * that started it most recently. Otherwise returns the station that starts
 * it soonest and how long until then (`startsIn`, seconds).
 */
export const findAiring = (schedule, index, nowMs) => {
  const { starts, total, size, positionOf, sortedOffsets, stationsByOffset } = schedule;
  const position = positionOf[index];
  const duration = starts[position + 1] - starts[position];
  // A station whose starting point is `o` is wrap(o − lower) seconds into the video.
  const lower = wrap(starts[position] - (nowMs - EPOCH_MS) / 1000, total);
  // The first station at or after `lower` started it most recently…
  const latest = (lastAtOrBefore(sortedOffsets, size, lower - 1e-9) + 1) % size;
  const offset = wrap(sortedOffsets[latest] - lower, total);
  if (offset < duration) return { station: stationsByOffset[latest], offset, onNow: true };
  // …and the one just before it reaches it soonest.
  const soonest = (latest - 1 + size) % size;
  return { station: stationsByOffset[soonest], startsIn: total - wrap(sortedOffsets[soonest] - lower, total), onNow: false };
};

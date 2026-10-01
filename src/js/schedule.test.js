import { makeSchedule, onAir, findAiring, EPOCH_MS } from './schedule';

const lineupOf = (durations) => durations.map((duration, i) => ({ id: `video-${i}`, duration }));
const lineup = lineupOf([100, 50, 200, 80, 120, 60, 90, 150]);
const schedule = makeSchedule(lineup);
const total = 850;
const at = (seconds) => EPOCH_MS + seconds * 1000;

test('the loop is a fixed shuffle of the lineup', () => {
  expect([...schedule.order].sort((a, b) => a - b)).toEqual(lineup.map((_, i) => i));
  expect(schedule.total).toBe(total);
  const big = makeSchedule(lineupOf(Array(50).fill(60)));
  expect(big.order).not.toEqual(Array.from({ length: 50 }, (_, i) => i));
  expect(makeSchedule(lineup).order).toEqual(schedule.order);
});

test('a new concert slots in without reordering the rest', () => {
  const grown = makeSchedule([{ id: 'brand-new', duration: 70 }, ...lineup]);
  const before = schedule.order.map((i) => lineup[i].id);
  const after = grown.order.map((i) => (i === 0 ? 'brand-new' : lineup[i - 1].id)).filter((id) => id !== 'brand-new');
  expect(after).toEqual(before);
});

test('is the same for every viewer at the same moment', () => {
  const now = Date.now();
  for (let station = 0; station < lineup.length; station++) {
    expect(onAir(makeSchedule(lineup), station, now)).toEqual(onAir(schedule, station, now));
  }
});

test('advances with the clock and loops', () => {
  for (let station = 0; station < lineup.length; station++) {
    const a = onAir(schedule, station, at(1000));
    const b = onAir(schedule, station, at(1000 + Math.min(5, a.remaining / 2)));
    expect(b.index).toBe(a.index);
    expect(b.offset).toBeCloseTo(a.offset + Math.min(5, a.remaining / 2));
    for (const later of [onAir(schedule, station, at(1000 + total * 3)), onAir(schedule, station, at(1000 - total * 2))]) {
      expect(later.index).toBe(a.index);
      expect(later.offset).toBeCloseTo(a.offset);
    }
  }
});

test('offset + remaining is always the concert’s length', () => {
  for (const seconds of [0, 1, 99, 400, 849, 851, -40]) {
    for (let station = 0; station < lineup.length; station++) {
      const { index, offset, remaining } = onAir(schedule, station, at(seconds));
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset + remaining).toBeCloseTo(lineup[index].duration);
    }
  }
});

test('neighbouring stations are far apart in the loop', () => {
  const big = makeSchedule(lineupOf(Array(1900).fill(1200)));
  const gap = (a, b) => {
    const d = Math.abs(big.offsets[a] - big.offsets[b]) % big.total;
    return Math.min(d, big.total - d) / big.total;
  };
  for (let k = 0; k + 2 < 1900; k++) {
    expect(gap(k, k + 1)).toBeGreaterThan(0.3); // {φ} apart: ~0.38 of the loop
    expect(gap(k, k + 2)).toBeGreaterThan(0.2);
  }
  // …so channels side by side never share a concert, now or next.
  const now = at(123456);
  for (let k = 0; k < 1899; k++) {
    const a = onAir(big, k, now).index;
    const b = onAir(big, k + 1, now).index;
    expect(Math.abs(big.positionOf[a] - big.positionOf[b])).toBeGreaterThan(1);
  }
});

test('findAiring agrees with onAir, on now or coming up', () => {
  // One long concert crowds others off the air, so some aren't on anywhere.
  const lopsided = makeSchedule(lineupOf([10, 2000, 10, 15, 20]));
  let notOnNow = 0;
  for (const s of [lineup, lineupOf([10, 2000, 10, 15, 20])]) {
    const sch = s === lineup ? schedule : lopsided;
    for (const seconds of [0, 17, 99, 260, 849, 1500, -40]) {
      for (let index = 0; index < s.length; index++) {
        const hit = findAiring(sch, index, at(seconds));
        if (!hit.onNow) notOnNow += 1;
        // (a millisecond past the start, clear of float rounding at the boundary)
        const check = onAir(sch, hit.station, at(seconds + (hit.onNow ? 0 : hit.startsIn + 0.001)));
        expect(check.index).toBe(index);
        expect(check.offset).toBeCloseTo(hit.onNow ? hit.offset : 0.001);
        // "Not on now" really means no station is showing it.
        const anywhere = s.some((_, k) => onAir(sch, k, at(seconds)).index === index);
        expect(anywhere).toBe(hit.onNow);
      }
    }
  }
  expect(notOnNow).toBeGreaterThan(0);
});

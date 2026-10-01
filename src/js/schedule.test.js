import { makeSchedule, onAir, findAiring, EPOCH_MS } from './schedule';

const lineup = [{ duration: 100 }, { duration: 50 }, { duration: 200 }];
const schedule = makeSchedule(lineup);
const at = (seconds) => EPOCH_MS + seconds * 1000;

test('station k starts on video k at the epoch', () => {
  expect(onAir(schedule, 0, at(0))).toMatchObject({ index: 0, offset: 0 });
  expect(onAir(schedule, 1, at(0))).toMatchObject({ index: 1, offset: 0 });
  expect(onAir(schedule, 2, at(0))).toMatchObject({ index: 2, offset: 0 });
});

test('advances through the lineup with the clock', () => {
  expect(onAir(schedule, 0, at(30))).toMatchObject({ index: 0, offset: 30, remaining: 70 });
  expect(onAir(schedule, 0, at(120))).toMatchObject({ index: 1, offset: 20 });
  expect(onAir(schedule, 1, at(60))).toMatchObject({ index: 2, offset: 10 });
});

test('loops back to the start of the lineup', () => {
  expect(onAir(schedule, 2, at(210))).toMatchObject({ index: 0, offset: 10 });
  expect(onAir(schedule, 0, at(350 * 3 + 5))).toMatchObject({ index: 0, offset: 5 });
});

test('is the same for every viewer at the same moment', () => {
  const now = Date.now();
  expect(onAir(makeSchedule(lineup), 1, now)).toEqual(onAir(makeSchedule(lineup), 1, now));
});

test('handles clocks before the epoch', () => {
  expect(onAir(schedule, 0, at(-10))).toMatchObject({ index: 2, offset: 190 });
});

test('findAiring finds the station showing a video right now', () => {
  // At 30 s, station 0 is 30 s into video 0; station 2 is 30 s into video 2.
  expect(findAiring(schedule, 0, at(30))).toEqual({ station: 0, offset: 30, onNow: true });
  expect(findAiring(schedule, 2, at(30))).toEqual({ station: 2, offset: 30, onNow: true });
});

test('findAiring agrees with onAir, wrapping around the loop', () => {
  for (const seconds of [0, 17, 99, 149, 260, 349, 1000, -40]) {
    for (let index = 0; index < lineup.length; index++) {
      const hit = findAiring(schedule, index, at(seconds));
      const check = onAir(schedule, hit.station, at(seconds + (hit.onNow ? 0 : hit.startsIn)));
      expect(check.index).toBe(index);
      expect(check.offset).toBeCloseTo(hit.onNow ? hit.offset : 0);
    }
  }
});

test('findAiring says when a video next starts if nobody is showing it', () => {
  // One long video crowds the short ones out:
  const lopsided = makeSchedule([{ duration: 10 }, { duration: 1000 }, { duration: 10 }]);
  // at 15 s, stations 0 and 1 are in video 1 and station 2 has wrapped
  // round to video 0, so video 2 is on nowhere.
  const hit = findAiring(lopsided, 2, at(15));
  expect(hit.onNow).toBe(false);
  expect(onAir(lopsided, hit.station, at(15 + hit.startsIn))).toMatchObject({ index: 2 });
});

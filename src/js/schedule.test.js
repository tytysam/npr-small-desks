import { makeSchedule, onAir, EPOCH_MS } from './schedule';

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

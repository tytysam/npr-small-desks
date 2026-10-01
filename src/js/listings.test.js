import { makeSchedule, EPOCH_MS } from './schedule';
import { PER_PAGE, pageOf, pageCount, indexTabs, listingFor, searchChannels } from './listings';

const lineup = [
  { artist: 'Björk', title: 'Björk: Tiny Desk Concert', duration: 100 },
  { artist: 'Mac Miller', title: 'Mac Miller: Tiny Desk Concert', duration: 50 },
  { artist: 'Tank and the Bangas', title: 'Tank And The Bangas: Tiny Desk Concert', duration: 200 },
];
const schedule = makeSchedule(lineup);
const at = (seconds) => EPOCH_MS + seconds * 1000;

test('pages hold PER_PAGE channels', () => {
  expect(pageOf(0)).toBe(0);
  expect(pageOf(PER_PAGE - 1)).toBe(0);
  expect(pageOf(PER_PAGE)).toBe(1);
  expect(pageCount(0)).toBe(1);
  expect(pageCount(1906)).toBe(Math.ceil(1906 / PER_PAGE));
});

test('index tabs fall on each hundred', () => {
  const tabs = indexTabs(1906);
  expect(tabs).toHaveLength(20);
  expect(tabs[0]).toEqual({ label: '1', index: 0 });
  expect(tabs[19]).toEqual({ label: '1901', index: 1900 });
});

test('live listings give now and next with times', () => {
  const entry = listingFor(schedule, 0, at(30), true);
  expect(entry.now).toEqual({ index: 0, startMs: at(0), endMs: at(100), progress: 0.3 });
  expect(entry.next).toEqual({ index: 1, startMs: at(100) });
});

test('VCR listings are the station’s own concert', () => {
  expect(listingFor(schedule, 2, at(30), false)).toEqual({ station: 2, now: { index: 2 } });
});

test('search ignores case and accents and matches every word', () => {
  expect(searchChannels(lineup, 'bjork')).toEqual([0]);
  expect(searchChannels(lineup, 'TANK bangas')).toEqual([2]);
  expect(searchChannels(lineup, 'tiny desk')).toEqual([0, 1, 2]);
  expect(searchChannels(lineup, '  ')).toEqual([]);
});

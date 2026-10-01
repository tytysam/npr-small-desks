import { makeShuffleBag } from './shuffleBag';

test('draws every index once per pass', () => {
  const bag = makeShuffleBag(50);
  const seen = new Set(Array.from({ length: 50 }, () => bag.next(-1)));
  expect(seen.size).toBe(50);
});

test('never returns the excluded index', () => {
  const bag = makeShuffleBag(3);
  for (let i = 0; i < 300; i += 1) expect(bag.next(1)).not.toBe(1);
});

test('handles a one-channel lineup', () => {
  expect(makeShuffleBag(1).next(0)).toBe(0);
});

import { tapeCounter } from './clock';

test('the tape counter reads hours, minutes and seconds', () => {
  expect(tapeCounter(0)).toBe('0:00:00');
  expect(tapeCounter(754.9)).toBe('0:12:34');
  expect(tapeCounter(3725)).toBe('1:02:05');
  expect(tapeCounter(-3)).toBe('0:00:00');
});

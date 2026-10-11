import { CRT_DEFAULTS, normalizeCrt, adjustCrt, describeCrt, CRT_ITEMS } from './crtSettings';

test('fills in missing or bad values with defaults', () => {
  expect(normalizeCrt(null)).toEqual(CRT_DEFAULTS);
  expect(normalizeCrt({ scanlines: 99, vhs: 'yes', curvature: 2 })).toEqual({ ...CRT_DEFAULTS, curvature: 2 });
});

test('levels clamp to 0–10', () => {
  expect(adjustCrt({ ...CRT_DEFAULTS, scanlines: 10 }, 'scanlines', 1).scanlines).toBe(10);
  expect(adjustCrt({ ...CRT_DEFAULTS, scanlines: 0 }, 'scanlines', -1).scanlines).toBe(0);
  expect(adjustCrt(CRT_DEFAULTS, 'scanlines', 1).scanlines).toBe(6);
});

test('toggles flip either way and choices cycle', () => {
  expect(adjustCrt(CRT_DEFAULTS, 'vhs', -1).vhs).toBe(true);
  expect(adjustCrt(CRT_DEFAULTS, 'broadcast', 1).broadcast).toBe(false);
  expect(adjustCrt({ ...CRT_DEFAULTS, broadcast: false }, 'broadcast', 1).broadcast).toBe(true);
});

test('describes values for the menu', () => {
  const byKey = Object.fromEntries(CRT_ITEMS.map((i) => [i.key, i]));
  expect(describeCrt(CRT_DEFAULTS, byKey.broadcast)).toBe('Live');
  expect(describeCrt(CRT_DEFAULTS, byKey.vhs)).toBe('Off');
  expect(describeCrt(CRT_DEFAULTS, byKey.scanlines)).toBe(5);
});

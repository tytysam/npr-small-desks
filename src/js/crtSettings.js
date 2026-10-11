/**
 * Picture settings shown in the set's SETUP menu. `level` items run 0–10,
 * `toggle` items are on/off, `choice` items step through `options`.
 */
export const CRT_ITEMS = [
  { key: 'broadcast', label: 'Broadcast', type: 'choice', options: [[true, 'Live'], [false, 'VCR']] },
  { key: 'scanlines', label: 'Scanlines', type: 'level' },
  { key: 'curvature', label: 'Curvature', type: 'level' },
  { key: 'warmup', label: 'Warm-up', type: 'toggle' },
  { key: 'degauss', label: 'Degauss', type: 'toggle' },
  { key: 'vhs', label: 'VHS', type: 'toggle' },
  { key: 'hiss', label: 'Hiss', type: 'toggle' },
  { key: 'captions', label: 'Captions', type: 'toggle' },
];

export const CRT_DEFAULTS = {
  broadcast: true,
  scanlines: 5,
  curvature: 5,
  warmup: true,
  degauss: true,
  vhs: false,
  hiss: true,
  captions: false,
};

const LEVEL_MAX = 10;

/** Settings with anything missing or malformed replaced by its default. */
export const normalizeCrt = (value) => {
  const out = { ...CRT_DEFAULTS };
  if (!value || typeof value !== 'object') return out;
  CRT_ITEMS.forEach(({ key, type, options }) => {
    const v = value[key];
    if (type === 'level' && Number.isInteger(v) && v >= 0 && v <= LEVEL_MAX) out[key] = v;
    if (type === 'toggle' && typeof v === 'boolean') out[key] = v;
    if (type === 'choice' && options.some(([o]) => o === v)) out[key] = v;
  });
  return out;
};

/** Settings after nudging `key` one step in `direction` (+1 / -1). */
export const adjustCrt = (settings, key, direction) => {
  const item = CRT_ITEMS.find((i) => i.key === key);
  const current = settings[key];
  let next = current;
  if (item.type === 'level') next = Math.min(LEVEL_MAX, Math.max(0, current + direction));
  if (item.type === 'toggle') next = !current;
  if (item.type === 'choice') {
    const i = item.options.findIndex(([o]) => o === current);
    next = item.options[(i + direction + item.options.length) % item.options.length][0];
  }
  return next === current ? settings : { ...settings, [key]: next };
};

/** The value as the menu prints it. */
export const describeCrt = (settings, item) => {
  const v = settings[item.key];
  if (item.type === 'toggle') return v ? 'On' : 'Off';
  if (item.type === 'choice') return item.options.find(([o]) => o === v)[1];
  return v;
};

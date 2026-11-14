/**
 * The Scene pane's settings: how the room around the 3D set looks (its
 * views and lighting).
 */

/** Camera views, in the order C steps through them. */
export const VIEWS = [
  { key: 'front', label: 'Front' },
  { key: 'angle', label: '¾' },
  { key: 'back', label: 'Back' },
  { key: 'top', label: 'Top' },
  { key: 'watch', label: 'Watch' },
];

/** The view after `key`, for C. */
export const nextView = (key) => VIEWS[(VIEWS.findIndex((v) => v.key === key) + 1) % VIEWS.length].key;

/**
 * Lighting moods (their lights are in tv3d/moods.js). `dim` darkens the wall
 * behind the 3D set to match: 0 leaves it, 1 is black.
 */
export const MOODS = [
  { key: 'morning', label: 'Morning', dim: 0.1 },
  { key: 'afternoon', label: 'Afternoon', dim: 0 },
  { key: 'evening', label: 'Evening', dim: 0.35 },
  { key: 'lightsOut', label: 'Lights out', dim: 0.8 },
];

/** The wall: the page behind both sets, lit from the top (hi → lo). */
export const WALL = { hi: '#262626', mid: '#141414', lo: '#0c0c0c' };

export const SCENE_DEFAULTS = {
  mood: 'afternoon',
};

const CHOICES = { mood: MOODS };

/** Settings with anything missing or malformed replaced by its default. */
export const normalizeScene = (value) => {
  const out = { ...SCENE_DEFAULTS };
  if (!value || typeof value !== 'object') return out;
  Object.entries(CHOICES).forEach(([key, options]) => {
    if (options.some((o) => o.key === value[key])) out[key] = value[key];
  });
  return out;
};

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

/** A colour darkened toward black by `amount` (0–1). */
export const dimColor = (hex, amount) => toHex(hexToRgb(hex).map((c) => c * (1 - amount)));

/** The wall's three tones, dimmed for the mood when the 3D set is showing. */
export const wallTones = (settings, { is3d }) => {
  const dim = is3d ? MOODS.find((m) => m.key === settings.mood).dim : 0;
  return { hi: dimColor(WALL.hi, dim), mid: dimColor(WALL.mid, dim), lo: dimColor(WALL.lo, dim) };
};

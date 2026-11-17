import * as THREE from 'three';

/**
 * The 3D set's lighting moods (the Scene pane's Lighting row; names and the
 * wall's dimming are in src/js/sceneSettings.js). Each is the full rig:
 *
 * - ambient: an even base everywhere
 * - key: the warm directional light that casts the shadows
 * - fill: a softer light from the other side
 * - rim: a spotlight from behind, edging the cabinet
 * - env: how strongly chrome and glass reflect the studio environment
 * - contact: the soft shadow under the set
 * - glow: the tube lighting the set (TVModel's glow light), 0–1
 *
 * Afternoon is the set as designed. Tweak moods here.
 */
export const MOOD_LIGHTS = {
  // Early sun, low through a window on the right: pale gold and raking,
  // with cool sky light filling the shadows.
  morning: {
    ambient: 0.2,
    ambientColor: '#d2deff',
    key: 3,
    keyColor: '#ffcf94',
    keyPos: [8, 2.2, 3.5],
    fill: 0.45,
    fillColor: '#9fb8ff',
    rim: 0.9,
    rimColor: '#ffdcae',
    env: 0.6,
    contact: 0.45,
    glow: 0,
  },
  afternoon: {
    ambient: 0.4,
    ambientColor: '#ffffff',
    key: 2.4,
    keyColor: '#fff1dc',
    keyPos: [4, 7, 6],
    fill: 0.8,
    fillColor: '#ffffff',
    rim: 0.8,
    rimColor: '#ffffff',
    env: 1,
    contact: 0.65,
    glow: 0,
  },
  // A table lamp off to the left, the room going dim around it.
  evening: {
    ambient: 0.14,
    ambientColor: '#ffd9b0',
    key: 1.7,
    keyColor: '#ffb469',
    keyPos: [-5, 4, 5],
    fill: 0.22,
    fillColor: '#8a98c8',
    rim: 0.45,
    rimColor: '#ffcc90',
    env: 0.45,
    contact: 0.55,
    glow: 0.35,
  },
  // Only the picture lights the room.
  lightsOut: {
    ambient: 0.06,
    ambientColor: '#8a9cff',
    key: 0,
    keyColor: '#fff1dc',
    keyPos: [4, 7, 6],
    fill: 0.04,
    fillColor: '#6070a0',
    rim: 0.12,
    rimColor: '#7f90d0',
    env: 0.1,
    contact: 0.3,
    glow: 1,
  },
};

const a = new THREE.Color();
const b = new THREE.Color();

/** Two moods mixed, `t` of the way from `from` to `to` (0–1). */
export const mixMoods = (from, to, t) =>
  Object.fromEntries(
    Object.keys(to).map((key) => {
      const x = from[key];
      const y = to[key];
      if (typeof y === 'number') return [key, x + (y - x) * t];
      if (Array.isArray(y)) return [key, y.map((v, i) => x[i] + (v - x[i]) * t)];
      return [key, `#${a.set(x).lerp(b.set(y), t).getHexString()}`];
    })
  );

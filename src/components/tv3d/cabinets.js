import { makeLayout } from './layout';

/**
 * Each cabinet's 3D measurements (world units; names and woods are in
 * src/js/cabinets.js). The tube is the same in all of them; what changes is
 * the box around it, where the controls sit, and what it stands on.
 *
 * - cabinet: the body; bodyRadius rounds its edges
 * - bezel: centre and size of the bezel around the tube
 * - top: the top board, `w`/`d` wider and deeper than the body
 * - plinth: a base board under the body, or null
 * - guide, antenna: where they stand on the top board
 * - panel: right of the bezel. `column` is a chrome-trimmed metal column
 *   with the knobs stacked above a perforated speaker; `grille` is a wooden
 *   panel with the knobs side by side above a cloth grille. Positions in it
 *   are relative to its centre (which is level with the bezel's).
 * - rail: the lower rail, `groove` (routed into the board) or `brass` (a
 *   brushed strip); x positions of its controls
 * - legs: `slab` (tapered, splayed slabs) or `pencil` (thin round legs with
 *   brass ferrules), and their spread and splay
 * - floorY: where the feet stand (the contact shadow)
 * - framing: the front view's camera distance, height and aim, the
 *   narrowest viewport (width ÷ height) that fits at that distance, and
 *   where the Watch view aims (x, y)
 */
export const CABINET_SPECS = {
  walnut: {
    cabinet: { w: 6.5, h: 4.7, d: 3.4 },
    bodyRadius: 0.06,
    bezel: { x: -0.73, y: 0.35, w: 4.44, h: 3.44 },
    top: { w: 0.16, d: 0.12, thickness: 0.12, y: 0.04, radius: 0.04 },
    plinth: { w: -0.3, d: -0.4, height: 0.14, y: -0.06 },
    guide: { x: -1.75, z: 1.08 },
    antenna: { x: 1.9, z: -0.5 },
    panel: {
      kind: 'column',
      x: 2.29,
      w: 1.32,
      channel: [0, 1.12],
      volume: [0, 0],
      speaker: { y: -0.9, w: 1.02, h: 0.78 },
      power: [0, -1.47],
    },
    rail: {
      kind: 'groove',
      y: -1.77,
      menu: -2.75,
      badge: -2.3,
      tuning: -0.75,
      input: 0.68,
      louvres: { x: 1.281, w: 0.722 },
      // heart, lever, lamp and brightness knob sit an even ~0.155 apart, the
      // knob ~1.4x the heart's width, as on the 2D rail
      heart: 1.865,
      lever: 2.163,
      lamp: 2.443,
      brightness: 2.744,
    },
    legs: { kind: 'slab', width: 0.46, depth: 0.22, length: 0.83, spreadX: 2.7, spreadZ: 1.2, splayX: 0.3, splayZ: 0.12, top: -0.1 },
    floorY: -3.28,
    framing: { distance: 12.4, cameraY: 0.8, targetY: 0.35, comfortAspect: 1.15, watch: [-0.365, 0] },
  },

  // Danish modern, about 1964: wider and lower, teak with a blond bezel, the
  // knobs above a cloth grille, a brass rail, tall pencil legs.
  teak: {
    cabinet: { w: 7.8, h: 4.5, d: 3.0 },
    bodyRadius: 0.03,
    bezel: { x: -1.35, y: 0.25, w: 4.44, h: 3.44 },
    top: { w: 0.44, d: 0.16, thickness: 0.09, y: 0.025, radius: 0.03 },
    plinth: null,
    guide: { x: -2.3, z: 0.82 },
    antenna: { x: 2.6, z: -0.4 },
    panel: {
      kind: 'grille',
      x: 2.295,
      w: 2.55,
      channel: [-0.62, 1.0],
      volume: [0.62, 1.0],
      speaker: { y: -0.47, w: 2.25, h: 1.55 },
      power: [0, -1.48],
    },
    rail: {
      kind: 'brass',
      y: -1.82,
      menu: -3.4,
      badge: -2.95,
      tuning: -1.35,
      input: 0.25,
      louvres: { x: 1.45, w: 1.5 },
      heart: 2.45,
      lever: 2.75,
      lamp: 3.03,
      brightness: 3.33,
    },
    legs: { kind: 'pencil', radius: [0.085, 0.045], spreadX: 3.35, spreadZ: 1.0, splayX: 0.14, splayZ: 0.12, top: -0.02, ferrule: 0.13 },
    floorY: -3.28,
    framing: { distance: 12.4, cameraY: 0.7, targetY: 0.2, comfortAspect: 1.4, watch: [0, -0.1] },
  },
};

const layouts = new Map();

/** A cabinet's measurements and its derived layout (makeLayout), cached. */
export const cabinetLayout = (key) => {
  const k = CABINET_SPECS[key] ? key : 'walnut';
  if (!layouts.has(k)) layouts.set(k, { key: k, spec: CABINET_SPECS[k], ...makeLayout(CABINET_SPECS[k]) });
  return layouts.get(k);
};

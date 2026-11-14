import { makeLayout } from './layout';

/**
 * Each cabinet's 3D measurements (world units; names and woods are in
 * src/js/cabinets.js). The tube is the same in all of them; what changes is
 * the box around it, where the controls sit, and what it stands on.
 *
 * - body: 'pod' when the tube stands on the cabinet in its own `shell`
 *   (the cream set); otherwise the tube is set into the cabinet's front
 * - cabinet: the body (a base, when it's a pod: `y` lowers it); bodyRadius
 *   rounds its edges
 * - bezel: centre and size of the bezel around the tube; a `pillow` one is
 *   the cream set's lip
 * - shell: the pod's shell, as rings lofted back from the bezel, its boss,
 *   and the neck it stands on
 * - top: the top board, `w`/`d` wider and deeper than the body
 * - plinth: a base board under the body, or null
 * - guide, antenna: where they stand on the top board (or on `topFace`)
 * - panel: the channel and volume knobs, power and the speaker. `column`
 *   is a chrome-trimmed metal column right of the bezel, the knobs stacked
 *   above a perforated speaker; `grille` a wooden panel with the knobs side
 *   by side above a cloth grille; `base` puts them straight on the front
 *   board (the cream set). Positions are relative to its centre (level with
 *   the bezel's, unless `y` says otherwise). Optional: the knobs' finish and
 *   volume knob size, dark `escutcheons` behind knobs, power as a `button`.
 * - rail: the lower rail, `groove` (routed into the board), `brass` (a
 *   brushed strip) or `none`; its controls' positions, as x or [x, y]; the
 *   tuning strip's width, the louvres' count and pitch, the buttons' finish;
 *   `inputStyle` spaces and colours the TV/VCR selector
 * - legs: `slab` (tapered, splayed slabs), `pencil` (thin round legs with
 *   brass ferrules, each in a mounting `block` under the body) or
 *   `runners` (the side panels, run down to the floor)
 * - back: the hardboard back's layout (makeBackPanelTexture), in pixels at
 *   the same scale on every set (2048 px across the walnut set's 6.2-unit
 *   back), so each is drawn at its own proportions rather than stretched
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
    back: { serial: '000001' }, // makeBackPanelTexture's defaults are this set's
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
      escutcheons: { channel: 0.6, volume: 0.5 },
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
      // the TV/VCR selector as on the 2D set: ON AIR as wide as the switch and
      // just above it, the labels tucked under, the group centred on the strip
      inputStyle: { onAir: 0.098, toggle: -0.012, labels: -0.094, onAirW: 0.3, unlit: '#4a1610', ink: '#e39486' },
      louvres: { x: 1.45, w: 1.5 },
      heart: 2.45,
      lever: 2.75,
      lamp: 3.03,
      brightness: 3.33,
    },
    // wider and shorter: more vent slots, the plate and tag nearer the vents
    back: {
      serial: '000214',
      size: [2477, 1387],
      vents: { x: 265, y: 150, cols: 33, rows: 3, slotH: 150 },
      caution: { x: 1164, y: 750 },
      plate: { x: 160, y: 1013 },
      tag: { x: 2029, y: 1098 },
    },
    // each leg screwed into a teak block under the corner
    legs: { kind: 'pencil', radius: [0.085, 0.045], spreadX: 3.45, spreadZ: 1.05, splayX: 0.14, splayZ: 0.12, block: { w: 0.5, h: 0.14, d: 0.42 }, ferrule: 0.13 },
    floorY: -3.28,
    framing: { distance: 12.4, cameraY: 0.7, targetY: 0.2, comfortAspect: 1.4, watch: [0, -0.1] },
  },

  // After Stig Lindberg's late-1950s Swedish design: the tube in its own
  // cream plastic shell, a dome behind tapering to a round neck, standing on
  // a low teak base that carries every control on its front. Unbranded.
  cream: {
    body: 'pod',
    cabinet: { w: 5.0, h: 1.6, d: 3.6, y: -2.4 }, // the base
    bodyRadius: 0.04,
    // The front: a slim rounded lip, `lip` wide, around glass that fills
    // nearly all of it, in a "pillow" outline (a superellipse, its corners
    // well rounded, a little wider at the top; see makePillowLoftGeometry).
    // The picture is drawn at `screen` of its usual size, so the rectangle
    // the 3D screen layer cuts through the scene stays inside the outline
    // (its corners would cut through the shell's wall), while the lip still
    // overlaps the picture's edges.
    bezel: { x: 0, y: 0.3, w: 4.32, h: 3.36, pillow: { n: 6, taper: 0.02, lip: 0.25, screen: 0.96 } },
    // The shell behind it: straight back for a while, then a puffy rounded
    // back with a large round boss a little below centre. Rings are scaled
    // copies of the front's outline (z relative to the front board; `n`
    // softens the outline toward the back). The neck it stands on.
    shell: {
      color: '#e6dcc6',
      rings: [
        { s: 1, z: -0.05 },
        { s: 0.995, z: -0.45 },
        { s: 0.97, z: -0.95, n: 3.8 },
        { s: 0.9, z: -1.5, n: 3.4 },
        { s: 0.76, z: -2.0, n: 3.0 },
        { s: 0.52, z: -2.35, n: 2.7 },
        { s: 0.3, z: -2.48, n: 2.4 },
      ],
      boss: { r: 0.85, y: -0.12, depth: 0.12 },
      neck: { r: 0.3, z: -1.25 },
    },
    top: { w: 0.04, d: 0.04, thickness: 0.06, y: 0, radius: 0.02 },
    topFace: 1.97, // the shell's top: the guide and the antenna stand there
    plinth: null,
    guide: { x: -0.2, z: 1.13 }, // centred on the shell's top, clear of the antenna
    antenna: { x: 1.25, z: 0.55 },
    // Everything on the base front: the knobs in grey plastic, the channel
    // dial on a dark escutcheon, power a push-button.
    panel: {
      kind: 'base',
      x: 0,
      y: -2.4,
      channel: [1.72, 0],
      volume: [-0.3, 0.05],
      knobs: { finish: 'grey', volume: { radius: 0.11, height: 0.09, ticks: 0.4, ridges: 24 } },
      escutcheons: { channel: 0.58 },
      speaker: null,
      power: { at: [0.9, 0.05], kind: 'button' },
    },
    rail: {
      kind: 'none',
      y: -2.4,
      buttons: 'grey',
      menu: [-2.2, 0.5],
      badge: [-1.75, 0.5],
      tuning: [0.35, 0.5],
      tuningW: 1.5,
      input: [-0.1, -0.45],
      louvres: { x: -1.35, y: -0.1, w: 1.6, n: 9, pitch: 0.075 },
      heart: [0.5, 0.05],
      lever: [0.55, -0.45],
      lamp: [0.95, -0.45],
      brightness: [0.1, 0.05],
    },
    // The base's back, a long low strip: one row of short vents, then the
    // plate, the caution and the tag side by side, drawn smaller.
    back: {
      serial: '000057',
      size: [1553, 429],
      screwInset: 45,
      vents: { x: 223, y: 45, cols: 19, rows: 1, slotH: 90 },
      plate: { x: 110, y: 175 },
      caution: { x: 760, y: 200 },
      tag: { x: 1265, y: 280 },
      scale: 0.55,
    },
    // The base's side panels run down past it as runners.
    legs: { kind: 'runners' },
    floorY: -3.3,
    framing: { distance: 12.4, cameraY: 0, targetY: -0.4, comfortAspect: 1.0, watch: [0, -0.5] },
  },
};

const layouts = new Map();

/** A cabinet's measurements and its derived layout (makeLayout), cached. */
export const cabinetLayout = (key) => {
  const k = CABINET_SPECS[key] ? key : 'walnut';
  if (!layouts.has(k)) layouts.set(k, { key: k, spec: CABINET_SPECS[k], ...makeLayout(CABINET_SPECS[k]) });
  return layouts.get(k);
};

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
 * - space: the even spacing the front is laid out on (optional); the brass
 *   rail's strip is inset from the board's ends by it
 * - bezel: centre and size of the bezel around the tube, and how wide its
 *   flat `face` is before the cove (0.08 unless given) and its outer corners'
 *   `radius` (0.1 unless given), `screen` to draw the tube bigger; a shallow `cove`
 *   instead of the deep rolled one (the teak set's); a `pillow` one is the
 *   cream set's lip
 * - shell: the pod's shell, as rings lofted back from the bezel (into a
 *   round boss at the back), and the neck it stands on
 * - top: the top board, `w`/`d` wider and deeper than the body, or null
 * - plinth: a base board under the body, or null
 * - guide, antenna: where they stand on the top board (or on `topFace`)
 * - panel: the channel and volume knobs, power and the speaker. `column`
 *   is a chrome-trimmed metal column right of the bezel, the knobs stacked
 *   above a perforated speaker; `grille` a wooden panel with the knobs side
 *   by side above a cloth grille; `base` puts them straight on the front
 *   board (the cream set). Positions are relative to its centre (level with
 *   the bezel's, unless `y` says otherwise). Optional: the knobs' finish and
 *   volume knob size, the channel knob's size (`channel`: its radius and its
 *   number ring's), or a bar handle instead of a knob (`style`), dark
 *   `escutcheons` behind knobs, power as a `button`.
 * - rail: the lower rail, `groove` (routed into the board), `brass` (a
 *   brushed strip) or `none`; its controls' positions, as x or [x, y]; the
 *   tuning strip's width, the louvres' count and pitch, the buttons' finish;
 *   `inputStyle` spaces and colours the TV/VCR selector; `metal: 'dark'`
 *   darkens its silver controls (and power's) a shade
 * - trim: brass accents, or none: a ring round the tube `opening`, the
 *   `grille` framed (widths)
 * - legs: `slab` (tapered, splayed slabs), `pencil` (thin round legs with
 *   brass ferrules, rising `sink` deep into the body) or
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
    // Its outer edges line up with the control column's and the rail's; the
    // tube drawn 3% bigger (`screen`) so the honey round it is 0.21 wide,
    // the 2D set's proportion. Its outer corners as tight as the column's.
    bezel: { x: -0.73, y: 0.35, w: 4.44, h: 3.44, radius: 0.04, screen: 1.03 },
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

  // Danish modern, about 1964: wider and lower, a plain box (no top board),
  // all teak picked out in brass (a ring round the tube, the grille framed,
  // a brass rail), the knobs above a cloth grille, tall pencil legs.
  teak: {
    cabinet: { w: 7.8, h: 4.5, d: 3.0 },
    bodyRadius: 0.03,
    // One spacing, `space`, throughout the front (as the 2D set's
    // --teak-space): round the bezel, the panel and the brass rail within
    // the front board (7.44 × 4.14), between them, and inside the panel,
    // measured to the brass.
    space: 0.12,
    // A shallow bezel, as on the 2D set: a flat face a space wide, standing
    // `rise` proud of the board, then a short cove (`w`) down to the brass
    // ring, the opening just `depth` under the board. Its margin round the
    // opening is even (0.12 + 0.093 + the ring's 0.017), so the cove's
    // corners can follow the opening's.
    bezel: { x: -1.42, y: 0.27, w: 4.36, h: 3.36, cove: { w: 0.093, rise: 0.04, depth: 0.02 } },
    top: null, // a plain box
    plinth: null,
    guide: { x: -2.3, z: 0.82 },
    antenna: { x: 2.6, z: -0.4 },
    panel: {
      kind: 'grille',
      // the rest of the board's width; the dials' brass rings (1.25, 1.05)
      // evenly spaced across it
      x: 2.24,
      w: 2.72,
      channel: [-0.595, 0.935],
      volume: [0.695, 0.935],
      escutcheons: { channel: 0.6, volume: 0.5 },
      // no knobs: a brass bar across each dial (Knob3D's 'bar')
      knobs: { style: 'bar' },
      // its brass frame (0.065 round the cloth) a space from the dials, the
      // panel's sides and the power switch (0.12 high), which sits a space
      // off the bottom
      speaker: { y: -0.565, w: 2.35, h: 1.38 },
      power: [0, -1.5],
    },
    rail: {
      kind: 'brass',
      metal: 'dark', // its silver controls a shade darker against the brass
      y: -1.74, // the strip (0.42 high) a space off the board's bottom
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
    // the tube's ring as thin as the dials' (0.025 showing), the grille's heavier
    trim: { opening: 0.017, grille: 0.05 },
    // wider and shorter: more vent slots, the plate and tag nearer the vents
    back: {
      serial: '000214',
      size: [2477, 1387],
      vents: { x: 265, y: 150, cols: 33, rows: 3, slotH: 150 },
      caution: { x: 1164, y: 750 },
      plate: { x: 160, y: 1013 },
      tag: { x: 2029, y: 1098 },
      screws: { finish: 'brass', scale: 0.8 },
    },
    // each leg rising into the body, its top buried `sink` deep
    legs: { kind: 'pencil', radius: [0.085, 0.045], spreadX: 3.45, spreadZ: 1.05, splayX: 0.14, splayZ: 0.12, sink: 0.08, ferrule: 0.13 },
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
    // The front, after the reference set: a rounded lip, `lip` wide, round
    // dark glass, in a squircle outline (a superellipse, n 4: straight-ish
    // sides flowing into broad corners, neither a rounded rectangle nor an
    // oval), barely wider at the top (`taper`; see makePillowLoftGeometry).
    // The picture is a squircle too, drawn at `screen` of its usual size so
    // it fills the glass (3.76 × 2.80, near enough 4:3) all but a hair, the
    // glass behind it the same black. Any bigger and the rectangle the screen
    // layer cuts through the scene pokes past the shell's outline at its
    // corners, specking the shell's edge from an angle.
    bezel: { x: 0, y: 0.3, w: 4.32, h: 3.36, pillow: { n: 4, taper: 0.008, lip: 0.28, screen: 0.92 } },
    // The shell behind it: straight back for a while, then a puffy rounded
    // back that runs out into a round boss, as one moulding: the rings are
    // scaled copies of the front's outline (`s`; z relative to the front
    // board, `n` softening the outline toward the back), then circles (`r`)
    // narrowing into the boss, along it, and rounding over its end to a
    // point (which closes it). The neck it stands on.
    shell: {
      color: '#e6dcc6',
      rings: [
        { s: 1, z: -0.05 },
        { s: 0.995, z: -0.45 },
        { s: 0.97, z: -0.95, n: 3.8 },
        { s: 0.9, z: -1.5, n: 3.4 },
        { s: 0.76, z: -2.0, n: 3.0 },
        { s: 0.52, z: -2.3, n: 2.5 },
        { r: 0.74, z: -2.4 },
        { r: 0.62, z: -2.47 },
        { r: 0.6, z: -2.55 },
        { r: 0.6, z: -2.7 },
        { r: 0.585, z: -2.75 },
        { r: 0.54, z: -2.78 },
        { r: 0.3, z: -2.8 },
        { r: 0.001, z: -2.8 },
      ],
      neck: { r: 0.3, z: -1.25 },
    },
    top: { w: 0.04, d: 0.04, thickness: 0.06, y: 0, radius: 0.02 },
    topFace: 1.97, // the shell's top: the guide and the antenna stand there
    plinth: null,
    guide: { x: -0.2, z: 1.13 }, // centred on the shell's top, clear of the antenna
    antenna: { x: 1.25, z: 0.55 },
    // Everything on the base front: two-tone dish knobs (cream skirts, grey
    // caps), the channel's numbers printed on its skirt under a brass notch;
    // power a push-button. Laid out on one gap,
    // 0.12, kept at the board's edges (4.64 × 1.24, so x ±2.32, y ±0.62)
    // and between the groups, in three columns: the louvres under the MENU
    // button, badge, pilot lamp and TV/VCR selector (spread edge to edge);
    // then the switches (power, play lever and heart) from the left a gap
    // apart and the brightness and volume dials at the right, a gap apart,
    // by the channel dial, all centred on the channel dial's centre (the
    // play lever on its hex nut); the tuning strip, edge to edge, at the
    // bottom. MENU and power are plain grey domed caps. The channel dial beside all three, the
    // board's full height less the gap.
    panel: {
      kind: 'base',
      x: 0,
      y: -2.4,
      channel: [1.82, 0],
      volume: [1.15, 0],
      knobs: {
        style: 'dish',
        brightness: { radius: 0.11 },
        volume: { radius: 0.17, height: 0.09, ridges: 44 },
        // under the notch, the board's height less the gap
        channel: { radius: 0.38 },
      },
      speaker: null,
      power: { at: [-0.395, 0], kind: 'button' },
    },
    rail: {
      kind: 'none',
      y: -2.4,
      buttons: 'dish',
      menu: [-2.115, 0.409],
      badge: [-1.627, 0.402], // spaced by its lettering (0.4 across), not its plate; its letters centred on MENU's
      tuning: [0.42, -0.395],
      tuningW: 1.8,
      input: [-0.76, 0.3525],
      inputStyle: { onAir: 0.11, labels: -0.09 },
      louvres: { x: -1.4, y: -0.1968, w: 1.6, n: 9, pitch: 0.0726 },
      heart: [0.148, 0],
      lever: [-0.115, 0],
      lamp: [-1.174, 0.409],
      brightness: [0.75, 0],
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

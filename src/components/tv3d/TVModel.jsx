import { useRef, useCallback, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import Knob3D from './Knob3D';
import useDisposable from './useDisposable';
import useFade from './useFade';
import useLatest from '../../hooks/useLatest';
import { BRIGHTNESS_MIN, BRIGHTNESS_MAX } from '../../js/picture';
import { cabinetFor } from '../../js/cabinets';
import ScreenSurface, { SCREEN_W, SCREEN_H } from './ScreenSurface';
import { cabinetLayout } from './cabinets';
import { Plate, Chrome, Silver, PushButton, GuideStack, Antenna, DARK_SILVER, DARK_CHROME } from './controls';
import { LAMP } from './lamps';
import {
  PALETTE,
  makeWoodTexture,
  makeWoodMaterial,
  boxProjectUVs,
  makeLoftGeometry,
  makePillowLoftGeometry,
  makePillowFaceGeometry,
  makeTaperedLegGeometry,
  makePerforatedTexture,
  makeClothTexture,
  makeBrushedBrass,
  makeKnurlTexture,
  makeGlareTexture,
  makeLabelTexture,
  makeChannelRingTexture,
  makeVolumeTicksTexture,
  makeDishNumbersTexture,
  makeFrameGeometry,
  makeDomeGeometry,
  makeBackPanelTexture,
} from './materials';

// Layout (world units) comes from the cabinet: its measurements are in
// cabinets.js, the positions derived from them in layout.js.

const LEG_CORNERS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

const LEVER = { length: 0.17, base: 0.018, tip: 0.013 };
const LEVER_TILT = 0.5; // radians forward of vertical

const VOLUME_SWEEP = 270;
const CHANNEL_DETENT = 30;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// The tube's glow in the dark lighting moods.
const GLOW = { color: '#a9c2ff', intensity: 7, flicker: 0.12 };

const BRASS = { color: '#c8a463', metalness: 0.6, roughness: 0.42 };

/** A rail or panel position: `x`, or `[x, y]` for one off the centre line. */
const at = (v) => (Array.isArray(v) ? v : [v, 0]);

// The TV/VCR selector's rows (y within it), the ON AIR lamp's width, its
// colour unlit and its lettering, unless a cabinet's rail says otherwise.
const INPUT_STYLE = { onAir: 0.15, toggle: 0, labels: -0.12, onAirW: 0.24, unlit: null, ink: '#ffe9e0' };

// The walnut set's knobs, unless a cabinet's panel says otherwise.
const VOLUME_KNOB = { radius: 0.3, height: 0.19, ticks: 0.92, ridges: 52 };
// and its channel knob: the knob, and the number ring printed round it
const CHANNEL_KNOB = { radius: 0.32, ring: 1.12 };

/** A ring `d` out from the tube's opening, its corners concentric with it. */
/** A dish knob's printed index line, toward its edge. */
const DishIndex = ({ radius }) => (
  <mesh position={[0, radius * 0.72, 0.001]}>
    <planeGeometry args={[radius * 0.08, radius * 0.3]} />
    <meshBasicMaterial color="#3d362c" />
  </mesh>
);

const aroundOpening = (OPENING, d, z) => ({ w: OPENING.w + 2 * d, h: OPENING.h + 2 * d, r: OPENING.r + d, z });

/**
 * A shallow bezel (`bezel.cove`, the teak set's): a low flat face, then a
 * short cove `cove.w` wide down to the brass ring round the opening (the
 * trim's `opening` wide), every ring inside the face concentric with the
 * opening, so the cove meets the ring evenly all the way round its corners.
 */
const shallowBezelRings = ({ BEZEL, OPENING, OPENING_Z, spec }) => {
  const { w, h, cove } = BEZEL;
  const ring = spec.trim?.opening ?? 0;
  const faceZ = cove.rise;
  const endZ = OPENING_Z + 0.01; // the brass ring's face
  // the outer corners as tight as the grille panel's beside it (0.02),
  // concentric as the eased edge rolls in
  const r = (inset) => Math.max(0.004, 0.02 - inset / 2);
  const rings = [
    { w, h, r: r(0), z: -0.03 }, // tucked under the board
    { w, h, r: r(0), z: faceZ - 0.02 }, // outer wall
    { w: w - 0.015, h: h - 0.015, r: r(0.015), z: faceZ - 0.005 }, // eased edge
    { w: w - 0.04, h: h - 0.04, r: r(0.04), z: faceZ }, // flat face
    aroundOpening(OPENING, ring + cove.w, faceZ),
  ];
  // Convex cove: rolls over, then drops to the ring.
  const steps = 6;
  for (let k = 1; k <= steps; k += 1) {
    const t = k / steps;
    rings.push(aroundOpening(OPENING, ring + cove.w * (1 - Math.sin((t * Math.PI) / 2)), faceZ + (endZ - faceZ) * (1 - Math.cos((t * Math.PI) / 2))));
  }
  // under the ring, down to a short throat behind the opening
  rings.push(aroundOpening(OPENING, ring, OPENING_Z - 0.03));
  rings.push({ ...OPENING, z: OPENING_Z - 0.08 });
  return rings;
};

/** Bezel profile, outer edge first. z is relative to the board's face. */
const bezelRings = (layout) => {
  if (layout.BEZEL.cove) return shallowBezelRings(layout);
  const { BEZEL, OPENING, OPENING_Z } = layout;
  const { w, h, face = 0.08, radius = 0.1 } = BEZEL;
  const faceW = w - 2 * face;
  const faceH = h - 2 * face;
  const faceR = radius;
  const rings = [
    { w, h, r: radius, z: -0.03 }, // tucked under the board
    { w, h, r: radius, z: 0.05 }, // outer wall
    { w: w - 0.015, h: h - 0.015, r: Math.max(0.01, radius - 0.005), z: 0.075 }, // eased edge
    { w: w - 0.05, h: h - 0.05, r: Math.max(0.01, radius - 0.015), z: 0.085 },
    { w: faceW, h: faceH, r: faceR, z: 0.085 }, // flat face
  ];
  // Convex cove: sweeps inward first, then drops toward the tube.
  const steps = 9;
  for (let k = 1; k <= steps; k += 1) {
    const t = k / steps;
    const across = Math.sin((t * Math.PI) / 2);
    const down = 1 - Math.cos((t * Math.PI) / 2);
    rings.push({
      w: faceW + (OPENING.w - faceW) * across,
      h: faceH + (OPENING.h - faceH) * across,
      r: faceR + (OPENING.r - faceR) * t,
      z: 0.085 + (OPENING_Z - 0.085) * down,
    });
  }
  rings.push({ ...OPENING, z: OPENING_Z - 0.08 }); // short throat behind the opening
  return rings;
};

/**
 * The cream set's lip, as pillow rings (makePillowLoftGeometry): out from the
 * shell's wall, over a rounded crest, and down its inner wall to the glass.
 * `d` is how far in from the outline each ring sits.
 */
const LIP_PROFILE = [
  { d: 0, z: -0.05 },
  { d: 0, z: 0.04 },
  { d: 0.03, z: 0.11 },
  { d: 0.08, z: 0.15 },
  { d: 0.14, z: 0.14 },
  { d: 0.19, z: 0.09 },
  { d: 0.21, z: 0.0 },
  { d: 1, z: -0.14 }, // the lip's full width, down at the glass
];
const lipRings = ({ BEZEL }) => {
  const { n, taper, lip } = BEZEL.pillow;
  return LIP_PROFILE.map(({ d, z }) => {
    const inset = d === 1 ? lip : d;
    return { a: BEZEL.w / 2 - inset, b: BEZEL.h / 2 - inset, n, taper, z };
  });
};

/**
 * The height of the cream set's shell top at (x, z), from its rings: for
 * standing things on it (the antenna), since the top falls away toward the
 * back. Taper is left out; it's small that high up.
 */
const shellTopAt = ({ BEZEL, BOARD_Z }, shell, x, z) => {
  const zRel = z - BOARD_Z;
  const rings = shell.rings;
  // the rings either side of z (past the last one, the last two)
  const behind = rings.findIndex((ring) => ring.z <= zRel);
  const i = behind === -1 ? rings.length - 1 : Math.max(1, behind);
  const [front, back] = [rings[i - 1], rings[i]];
  const t = Math.min(1, Math.max(0, (front.z - zRel) / (front.z - back.z)));
  const mix = (p, q) => p + (q - p) * t;
  const [p, q] = [shellRingSize({ BEZEL }, front), shellRingSize({ BEZEL }, back)];
  const n = mix(p.n, q.n);
  const a = mix(p.a, q.a);
  const b = mix(p.b, q.b);
  return BEZEL.y + b * Math.max(0, 1 - Math.abs(x / a) ** n) ** (1 / n);
};

/**
 * A shell ring's half-sizes and squareness: a scaled copy of the front's
 * outline (`s`), or a circle of radius `r` (the boss the back runs out into).
 */
const shellRingSize = ({ BEZEL }, { s, r, n }) =>
  r !== undefined
    ? { a: r, b: r, n: 2, taper: 0 }
    : { a: (BEZEL.w / 2) * s, b: (BEZEL.h / 2) * s, n: n ?? BEZEL.pillow.n, taper: BEZEL.pillow.taper };

/** The cream set's shell rings, lofted into its shell. */
const shellRings = (layout, shell) => shell.rings.map((ring) => ({ ...shellRingSize(layout, ring), z: ring.z }));

/**
 * Every wooden part of a cabinet, with UVs box-projected in world space
 * (`at` is where the mesh sits) so the grain runs continuously from one part
 * to the next.
 */
const makeWoodParts = (layout) => {
  const { spec, CABINET, CABINET_Y, BOARD, BOARD_Z, BODY, TOP_Y, BOTTOM_Y, BEZEL } = layout;
  const pod = spec.body === 'pod'; // the tube stands on the cabinet, in its own shell
  const { top, plinth, panel, legs } = spec;
  // The cabinet's boards share one grain, projected from the room's centre so
  // the body, rim, front board and top line up as if cut from one plank. Its
  // tile is at least as wide as the widest board (the top), so the grain never
  // repeats across a board and leaves a seam.
  const bodySpan = Math.max(7, CABINET.w + (top?.w ?? 0) + 0.3);
  const wood = (geometry, at, span = bodySpan) => ({ geometry: boxProjectUVs(geometry, { span, offset: at }), position: at });
  // Pieces cut separately (the bezel, a grille panel, runners, legs) are each
  // centred on their own tile, so a piece off to one side doesn't run past
  // the tile's edge.
  const piece = (geometry, at, span) => ({ geometry: boxProjectUVs(geometry, { span }), position: at });
  const parts = {
    // The cabinet's skin, one piece front to back: a sleeve (the rim round
    // the recessed front board, run on to the back), so its sides, top and
    // bottom have no seam where a separate rim would meet the body. Its
    // bevel (0.02) brings it out to the cabinet's size and rounds the front
    // and back edges; its long edges are rounded as `bodyRadius`.
    rim: wood(
      makeFrameGeometry({
        outerW: CABINET.w - 0.04,
        outerH: CABINET.h - 0.04,
        innerW: BOARD.w + 0.04,
        innerH: BOARD.h + 0.04,
        depth: CABINET.d - 0.04,
        radius: Math.max(0.005, spec.bodyRadius - 0.02),
        arcs: true,
        innerRadius: 0.03,
        bevelSize: 0.02,
        bevelSegments: 3,
      }),
      [0, CABINET_Y, -CABINET.d / 2 + 0.02]
    ),
    // The body inside it, a hair smaller all round so the sleeve is what's
    // drawn: it closes the sleeve's back (behind the hardboard) and fills
    // it behind the front board.
    body: wood(
      new RoundedBoxGeometry(CABINET.w - 0.01, CABINET.h - 0.01, BODY.d - 0.01, 4, spec.bodyRadius),
      [0, CABINET_Y, BODY.z + 0.005]
    ),
    // The front board, with a hole for the bezel; solid when the tube stands
    // above the cabinet.
    board: pod
      ? wood(new RoundedBoxGeometry(BOARD.w, BOARD.h, 0.04, 2, 0.01), [0, CABINET_Y, BOARD_Z - 0.02])
      : wood(
          makeFrameGeometry({
            outerW: BOARD.w,
            outerH: BOARD.h,
            innerW: BEZEL.w - 0.04,
            innerH: BEZEL.h - 0.04,
            innerOffset: [BEZEL.x, BEZEL.y],
            depth: 0.04,
            radius: 0.02,
            innerRadius: 0.08,
            bevelSize: 0,
          }),
          [0, 0, BOARD_Z - 0.04]
        ),
    top: top
      ? wood(new RoundedBoxGeometry(CABINET.w + top.w, top.thickness, CABINET.d + top.d, 3, top.radius), [0, TOP_Y + top.y, 0])
      : null,
    bezel: piece(
      BEZEL.pillow ? makePillowLoftGeometry(lipRings(layout)) : makeLoftGeometry(bezelRings(layout), 12),
      [BEZEL.x, BEZEL.y, BOARD_Z],
      5
    ),
  };
  if (plinth) {
    parts.plinth = wood(
      new RoundedBoxGeometry(CABINET.w + plinth.w, plinth.height, CABINET.d + plinth.d, 2, 0.03),
      [0, BOTTOM_Y + plinth.y, 0]
    );
  }
  // A grille panel is a board of the bezel's wood, standing proud of the front board.
  if (panel.kind === 'grille') {
    parts.panel = piece(new RoundedBoxGeometry(panel.w, BEZEL.h, 0.06, 2, 0.02), [panel.x, BEZEL.y, BOARD_Z + 0.01], 5);
  }
  // Runners: the side panels carried on past the body, standing on the floor.
  if (legs.kind === 'runners') {
    parts.legs = [-1, 1].map((sx) =>
      piece(
        new RoundedBoxGeometry(0.1, CABINET.h + 0.1, CABINET.d + 0.03, 2, 0.02),
        [sx * (CABINET.w / 2 - 0.04), CABINET_Y - 0.05, 0.015],
        5
      )
    );
  }
  if (legs.kind === 'slab') {
    // one per corner: each leans out toward its own corner
    parts.legs = LEG_CORNERS.map(([sx, sz]) =>
      piece(
        makeTaperedLegGeometry({
          ...legs,
          splay: [sx * legs.length * Math.tan(legs.splayX), sz * legs.length * Math.tan(legs.splayZ)],
        }),
        [sx * legs.spreadX, BOTTOM_Y + legs.top, sz * legs.spreadZ],
        2
      )
    );
  }
  return parts;
};

/**
 * Thin round legs, splayed out toward their corners, with brass ferrules.
 * Each rises into the body itself: its top is buried `sink` deep in the
 * cabinet's underside, so it never shows a gap however it's splayed. A brass
 * collar sits flat against the underside, square to the body rather than to
 * the leg, and the splayed leg passes through it at its own angle. `brass`
 * is the set's brass, if it has one.
 */
const PencilLegs = ({ layout, material, brass }) => {
  const { legs, floorY } = layout.spec;
  // the leg pivots from inside the body
  const topY = layout.BOTTOM_Y + legs.sink;
  // Long enough, once splayed, for the ferrule to stand on the floor.
  const length = (topY - floorY) / (Math.cos(legs.splayX) * Math.cos(legs.splayZ));
  const [rTop, rFoot] = legs.radius;
  // The collar: level, its top on the underside, centred where the leg
  // comes out of it (halfway down), and wide enough for the leg's slanted
  // section to pass through it.
  const collarH = 0.05;
  const collarDrop = legs.sink + collarH / 2;
  const rCollar = (rTop * 1.18) / Math.cos(Math.max(legs.splayX, legs.splayZ));
  const brassFinish = brass ? null : <meshStandardMaterial {...BRASS} roughness={0.3} />;
  return LEG_CORNERS.map(([sx, sz]) => (
    <group key={`${sx}${sz}`} position={[sx * legs.spreadX, topY, sz * legs.spreadZ]}>
      <mesh
        position={[sx * collarDrop * Math.tan(legs.splayX), -collarDrop, sz * collarDrop * Math.tan(legs.splayZ)]}
        material={brass}
        castShadow
      >
        <cylinderGeometry args={[rCollar, rCollar * 0.96, collarH, 24]} />
        {brassFinish}
      </mesh>
      <group rotation={[-sz * legs.splayZ, 0, sx * legs.splayX]}>
        <mesh position={[0, -length / 2, 0]} material={material} castShadow receiveShadow>
          <cylinderGeometry args={[rTop, rFoot, length, 20]} />
        </mesh>
        <mesh position={[0, -length + legs.ferrule / 2, 0]} material={brass} castShadow>
          <cylinderGeometry args={[rFoot * 1.08, rFoot * 1.02, legs.ferrule, 20]} />
          {brassFinish}
        </mesh>
      </group>
    </group>
  ));
};

/**
 * The console itself. Receives the same props as the 2D <TV/> plus
 * `onKnobDragging`, which the scene uses to pause orbiting mid-drag, and
 * `glow`, the lighting mood's tube glow. `cabinet` picks the cabinet
 * (src/js/cabinets.js); the controls are the same in every one.
 */
const TVModel = ({
  cabinet = 'walnut',
  screen,
  volume,
  onVolumeChange,
  onChannelChange,
  artistName,
  dialPosition,
  brightness,
  onBrightnessChange,
  isOn,
  onPowerToggle,
  paused,
  onPauseToggle,
  onMenuToggle,
  menuOpen,
  antenna,
  guideOpen,
  onGuideOpen,
  broadcast,
  onBroadcastToggle,
  hearted = false,
  canHeart = false,
  onHeartToggle,
  onKnobDragging,
  glow = 0,
}) => {
  const layout = cabinetLayout(cabinet);
  const { spec, CABINET, CABINET_Y, BOARD, BOARD_Z, FRONT_Z, TOP_FACE, BEZEL, OPENING, OPENING_Z, TUBE_Z, GUIDE } = layout;
  const { panel, rail, shell } = spec;
  const knobFinish = panel.knobs?.finish;
  // the rail's metal (lever, MENU, power and TV/VCR sliders): silver and
  // chrome, or a shade darker against the teak set's brass
  const darkMetal = rail.metal === 'dark';
  const silverColor = darkMetal ? DARK_SILVER : undefined;
  const chromeColor = darkMetal ? DARK_CHROME : undefined;
  const volumeKnob = panel.knobs?.volume ?? VOLUME_KNOB;
  const channelKnob = panel.knobs?.channel ?? CHANNEL_KNOB;
  const tuningW = rail.tuningW ?? 2.4;
  const inputStyle = { ...INPUT_STYLE, ...rail.inputStyle };
  const louvres = { n: 5, pitch: 0.06, y: 0, ...rail.louvres };
  const powerAt = Array.isArray(panel.power) ? panel.power : panel.power.at;
  const screenScale = BEZEL.pillow?.screen ?? BEZEL.screen ?? 1;
  const pillowGlass = useDisposable(() => {
    if (!BEZEL.pillow) return null;
    const { n, taper, lip } = BEZEL.pillow;
    // a little under the lip, so no gap shows at its inner edge
    return makePillowFaceGeometry({ a: BEZEL.w / 2 - lip + 0.06, b: BEZEL.h / 2 - lip + 0.06, n, taper });
  }, [BEZEL]);
  const { model, woods } = cabinetFor(layout.key);

  // --- materials ---------------------------------------------------------
  // "body" is the cabinet's wood (walnut on the NP-R1), "bezel" the bezel's
  // (honey; teak again on the NP-D6, cut finer); a grille panel is the
  // bezel's wood too.
  const bodyWood = useDisposable(() => makeWoodTexture(woods.body, 'body'), [woods.body]);
  const bezelWood = useDisposable(() => makeWoodTexture(woods.bezel, 'bezel'), [woods.bezel]);
  const body = useDisposable(() => makeWoodMaterial(bodyWood), [bodyWood]);
  const bodyShade = useDisposable(() => makeWoodMaterial(bodyWood, { tint: '#bfae9c', clearcoat: 0.35 }), [bodyWood]);
  const bezelWoodMaterial = useDisposable(() => makeWoodMaterial(bezelWood, { clearcoat: 0.7 }), [bezelWood]);
  // The cream set's bezel is the front of its plastic shell.
  const shellMaterial = useDisposable(
    () =>
      shell
        ? new THREE.MeshPhysicalMaterial({ color: shell.color, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3 })
        : null,
    [shell]
  );
  const bezel = shellMaterial ?? bezelWoodMaterial;
  const parts = useDisposable(() => makeWoodParts(layout), [layout]);
  // Lofted back to front, so its faces point outward (the bezel's, lofted
  // front to back, face into the cove).
  const shellGeometry = useDisposable(() => (shell ? makePillowLoftGeometry(shellRings(layout, shell).reverse()) : null), [layout, shell]);

  const sliderRibs = useDisposable(() => makeKnurlTexture(9), []);
  // The TV/VCR slider is ~half the power slider's width: half the ribs, same pitch.
  const inputRibs = useDisposable(() => makeKnurlTexture(5), []);
  const onAir = broadcast && isOn; // the ON AIR lamp: live, and the set switched on

  // --- lamps: ON AIR and the pilot lamp fade on and off ---------------------
  const onAirLampRef = useRef(null);
  const onAirLightRef = useRef(null);
  const onAirUnlit = useDisposable(() => (inputStyle.unlit ? new THREE.Color(inputStyle.unlit) : LAMP.onAir.off), [inputStyle.unlit]);
  useFade(onAir ? 1 : 0, (k) => {
    if (onAirLampRef.current) {
      onAirLampRef.current.color.lerpColors(onAirUnlit, LAMP.onAir.on, k);
      onAirLampRef.current.emissiveIntensity = LAMP.onAir.glow * k;
    }
    if (onAirLightRef.current) onAirLightRef.current.intensity = LAMP.onAir.light * k;
  });
  const pilotLampRef = useRef(null);
  const pilotLightRef = useRef(null);
  useFade(isOn ? 1 : 0, (k) => {
    if (pilotLampRef.current) {
      pilotLampRef.current.color.lerpColors(LAMP.pilot.off, LAMP.pilot.on, k);
      pilotLampRef.current.emissiveIntensity = LAMP.pilot.glow[0] + (LAMP.pilot.glow[1] - LAMP.pilot.glow[0]) * k;
    }
    if (pilotLightRef.current) pilotLightRef.current.intensity = LAMP.pilot.light * k;
  });

  // --- the tube's glow: the picture lighting the set in a dark room --------
  // (`glow` comes from the lighting mood). A cool light just in front of the
  // screen, fading with the power, flickering faintly as pictures do.
  const glowRef = useRef(null);
  const glowLevel = useRef(0);
  const flicker = useRef(1);
  const invalidate = useThree((state) => state.invalidate);
  const applyGlow = () => {
    if (glowRef.current) glowRef.current.intensity = GLOW.intensity * glowLevel.current * flicker.current;
  };
  useFade(isOn ? glow * brightness : 0, (k) => {
    glowLevel.current = k;
    applyGlow();
  });
  const flickering = isOn && glow > 0;
  useEffect(() => {
    if (!flickering || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = setInterval(() => {
      flicker.current = 1 - Math.random() * GLOW.flicker;
      applyGlow();
      invalidate();
    }, 110);
    return () => {
      clearInterval(id);
      flicker.current = 1;
    };
  }, [flickering, invalidate]);

  // Brass, all of it the rail's brushed brass (makeBrushedBrass): the rail
  // strip, and any trim and the dials' rings, the brushing scaled to match
  // the strip's (its UVs span the strip; theirs are in world units).
  const { trim } = spec;
  const railBrassWidth = BOARD.w - 2 * (spec.space ?? 0.1);
  const railBrass = useDisposable(() => (rail.kind === 'brass' ? makeBrushedBrass() : null), [rail.kind]);
  // the brightness bar's: the play lever's chrome, a shade darker, to
  // stand out on the rail's brass
  const barChrome = useDisposable(
    () => (trim ? new THREE.MeshStandardMaterial({ color: '#a9a9a5', metalness: 0.6, roughness: 0.25 }) : null),
    [trim]
  );
  const trimBrass = useDisposable(
    () => (trim ? makeBrushedBrass({ repeat: [3 / railBrassWidth, 1 / 0.42] }) : null),
    [trim, railBrassWidth]
  );
  // The trim's pieces: a ring round the tube opening, a frame round the grille.
  const trimGeometry = useDisposable(() => {
    if (!trim) return null;
    const o = trim.opening;
    return {
      opening: makeFrameGeometry({
        outerW: OPENING.w + 2 * o,
        outerH: OPENING.h + 2 * o,
        // its inner edge on the opening's (the bevel takes it in a little);
        // the bezel's cove covers its outer bevel, so `o` is what shows
        innerW: OPENING.w,
        innerH: OPENING.h,
        depth: 0.03,
        radius: OPENING.r + o,
        innerRadius: OPENING.r,
        bevelSize: 0.008,
        arcs: true, // concentric with the bezel's cove round it
      }),
      grille:
        panel.speaker && trim.grille
          ? // round the cloth's dark surround, a sliver of it showing inside
            makeFrameGeometry({
              outerW: panel.speaker.w + 0.03 + 2 * trim.grille,
              outerH: panel.speaker.h + 0.03 + 2 * trim.grille,
              innerW: panel.speaker.w + 0.03,
              innerH: panel.speaker.h + 0.03,
              depth: 0.012,
              radius: 0.03,
              innerRadius: 0.01,
              bevelSize: 0.006,
            })
          : null,
    };
  }, [trim, OPENING, panel]);
  const railBrassGeometry = useDisposable(
    () => (rail.kind === 'brass' ? new RoundedBoxGeometry(railBrassWidth, 0.42, 0.028, 3, 0.012) : null),
    [rail.kind, railBrassWidth]
  );
  const speakerTexture = useDisposable(
    () => (panel.kind === 'grille' ? makeClothTexture() : makePerforatedTexture({ repeat: [10, 8] })),
    [panel.kind]
  );
  const glareTexture = useDisposable(makeGlareTexture, []);
  const backPanelTexture = useDisposable(() => makeBackPanelTexture({ model, ...spec.back }), [model, spec.back]);
  // a dot for a bar handle to point at; the knobs' triangle otherwise
  const ringPointer = panel.knobs?.style === 'bar' ? 'dot' : 'arrow';
  const channelRingTexture = useDisposable(() => makeChannelRingTexture({ pointer: ringPointer }), [ringPointer]);
  const volumeTicksTexture = useDisposable(makeVolumeTicksTexture, []);
  // dish knobs (the cream set's): the channel numbers printed on the knob
  const dish = panel.knobs?.style === 'dish';
  const dishNumbersTexture = useDisposable(() => (dish ? makeDishNumbersTexture() : null), [dish]);
  const badgeTexture = useDisposable(
    () =>
      makeLabelTexture(model, {
        width: 320,
        height: 96,
        font: 'bold 60px Georgia, serif',
        color: '#24130a',
        letterSpacing: 10,
      }),
    [model]
  );
  const onAirTexture = useDisposable(
    () => makeLabelTexture('ON AIR', { width: 256, height: 80, font: 'bold 52px "Courier New", monospace', color: inputStyle.ink, letterSpacing: 6 }),
    [inputStyle.ink]
  );
  const inputLabelTexture = useDisposable(
    () =>
      makeLabelTexture('TV    VCR', {
        width: 320,
        height: 72,
        font: 'bold 46px "Courier New", monospace',
        // cream on the walnut, dark on the brass rail
        color: rail.kind === 'brass' ? '#2a1d10' : '#e8dfc8',
      }),
    [rail.kind]
  );
  const tuningTexture = useDisposable(
    () =>
      makeLabelTexture((artistName || 'Tiny Desk').toUpperCase(), {
        width: 1380,
        height: 120,
        font: 'bold 64px "Courier New", monospace',
        color: '#ffd79a',
        background: ['#120c06', '#2a1d10', '#1a1208'],
        letterSpacing: 6,
        glow: 'rgba(255,170,60,0.9)',
      }),
    [artistName]
  );

  // --- non-wood geometry -------------------------------------------------
  const throatGeometry = useDisposable(
    () =>
      makeFrameGeometry({
        outerW: OPENING.w + 0.04,
        outerH: OPENING.h + 0.04,
        innerW: OPENING.w - 0.08,
        innerH: OPENING.h - 0.08,
        depth: 0.01,
        radius: OPENING.r,
        innerRadius: OPENING.r - 0.04,
        bevelSize: 0,
      }),
    [OPENING]
  );
  const columnTrimGeometry = useDisposable(
    () =>
      panel.kind === 'column'
        ? makeFrameGeometry({
            outerW: panel.w,
            outerH: BEZEL.h,
            // a slim band: ~0.025 visible per side, bevels included
            innerW: panel.w - 0.03,
            innerH: BEZEL.h - 0.03,
            depth: 0.05,
            radius: 0.04,
            innerRadius: 0.02,
            bevelSize: 0.005,
            bevelSegments: 2,
          })
        : null,
    [panel, BEZEL]
  );
  const railGrooveGeometry = useDisposable(
    () =>
      rail.kind === 'groove'
        ? makeFrameGeometry({
            outerW: BOARD.w - 0.2,
            outerH: 0.6,
            innerW: BOARD.w - 0.24,
            innerH: 0.56,
            depth: 0.004,
            radius: 0.04,
            innerRadius: 0.03,
            bevelSize: 0,
          })
        : null,
    [rail, BOARD]
  );
  const domeGeometry = useDisposable(() => makeDomeGeometry(SCREEN_W * screenScale, SCREEN_H * screenScale, 0.09), [screenScale]);

  // --- volume knob -------------------------------------------------------
  const volumeRef = useLatest(volume);
  const handleVolumeDelta = useCallback(
    (delta) => {
      const next = clamp01(volumeRef.current + delta / VOLUME_SWEEP);
      if (next !== volumeRef.current) onVolumeChange(next);
    },
    [volumeRef, onVolumeChange]
  );

  // --- brightness knob ---------------------------------------------------
  const brightnessRef = useLatest(brightness);
  const handleBrightnessDelta = useCallback(
    (delta) => onBrightnessChange(brightnessRef.current + (delta / VOLUME_SWEEP) * (BRIGHTNESS_MAX - BRIGHTNESS_MIN)),
    [brightnessRef, onBrightnessChange]
  );

  // --- power switch ------------------------------------------------------
  const [switchHovered, setSwitchHovered] = useState(false);
  const handlePowerClick = useCallback(
    (e) => {
      e.stopPropagation();
      onPowerToggle();
    },
    [onPowerToggle]
  );
  const handleSwitchOver = useCallback((e) => {
    e.stopPropagation();
    setSwitchHovered(true);
    document.body.style.cursor = 'pointer';
  }, []);
  const handleSwitchOut = useCallback(() => {
    setSwitchHovered(false);
    document.body.style.cursor = '';
  }, []);

  // --- play/pause lever --------------------------------------------------
  const [leverHovered, setLeverHovered] = useState(false);
  const handleLeverClick = useCallback(
    (e) => {
      e.stopPropagation();
      onPauseToggle();
    },
    [onPauseToggle]
  );
  const handleLeverOver = useCallback((e) => {
    e.stopPropagation();
    setLeverHovered(true);
    document.body.style.cursor = 'pointer';
  }, []);
  const handleLeverOut = useCallback(() => {
    setLeverHovered(false);
    document.body.style.cursor = '';
  }, []);

  // --- TV/VCR input selector ----------------------------------------------
  const [inputHovered, setInputHovered] = useState(false);
  const handleInputClick = useCallback(
    (e) => {
      e.stopPropagation();
      onBroadcastToggle();
    },
    [onBroadcastToggle]
  );
  const handleInputOver = useCallback((e) => {
    e.stopPropagation();
    setInputHovered(true);
    document.body.style.cursor = 'pointer';
  }, []);
  const handleInputOut = useCallback(() => {
    setInputHovered(false);
    document.body.style.cursor = '';
  }, []);

  // --- channel knob ------------------------------------------------------
  // The dial position comes from the app (`dialPosition`), so it also turns
  // for keyboard changes and stays put across 2D/3D switches.
  const accumulatedRef = useRef(0);
  const handleChannelDelta = useCallback(
    (delta) => {
      accumulatedRef.current += delta;
      while (Math.abs(accumulatedRef.current) >= CHANNEL_DETENT) {
        const direction = accumulatedRef.current > 0 ? 1 : -1;
        accumulatedRef.current -= direction * CHANNEL_DETENT;
        onChannelChange(direction);
      }
    },
    [onChannelChange]
  );

  const startDrag = useCallback(() => onKnobDragging?.(true), [onKnobDragging]);
  const endDrag = useCallback(() => {
    accumulatedRef.current = 0;
    onKnobDragging?.(false);
  }, [onKnobDragging]);

  const woodMesh = (part, material, shadows = true) => (
    <mesh geometry={part.geometry} position={part.position} material={material} castShadow={shadows} receiveShadow />
  );

  // The knobs' and the power switch's faces: inset in the metal column, or
  // on the face of the wooden grille panel.
  // On the cream set's base, straight on the front board.
  const PANEL_Z = { column: BOARD_Z + 0.02, grille: BOARD_Z + 0.04, base: BOARD_Z }[panel.kind];

  return (
    <group>
      {/* cabinet: body, raised front rim, recessed front board, top board, plinth */}
      {woodMesh(parts.body, body)}
      {woodMesh(parts.rim, body)}
      {woodMesh(parts.board, body, false)}
      {parts.top && woodMesh(parts.top, body)}
      {parts.plinth && woodMesh(parts.plinth, bodyShade)}
      {/* the hardboard back, with the inspector's tag */}
      <mesh position={[0, CABINET_Y, -CABINET.d / 2 - 0.003]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[CABINET.w - 0.3, CABINET.h - 0.3]} />
        {/* faintly self-lit: the lights are all in front, and the print should still read */}
        <meshStandardMaterial map={backPanelTexture} emissiveMap={backPanelTexture} emissive="#ffffff" emissiveIntensity={0.22} roughness={0.85} />
      </mesh>

      {/* the bezel, rolling down into the cabinet toward the tube */}
      {woodMesh(parts.bezel, bezel)}

      {/* the cream set: the shell behind the bezel (running out into a round
          boss at its back), and the neck it stands on, on a swivel plate */}
      {shell && (
        <>
          <mesh geometry={shellGeometry} material={shellMaterial} position={[BEZEL.x, BEZEL.y, BOARD_Z]} castShadow receiveShadow />
          <mesh position={[BEZEL.x, (layout.TOP_Y + BEZEL.y - BEZEL.h / 2) / 2 + 0.06, BOARD_Z + shell.neck.z]} castShadow>
            <cylinderGeometry args={[shell.neck.r, shell.neck.r * 1.1, BEZEL.y - BEZEL.h / 2 - layout.TOP_Y + 0.25, 32]} />
            <meshStandardMaterial color="#cfc6b2" roughness={0.45} />
          </mesh>
          <mesh position={[BEZEL.x, layout.TOP_Y + 0.02, BOARD_Z + shell.neck.z]} receiveShadow>
            <cylinderGeometry args={[shell.neck.r * 1.6, shell.neck.r * 1.7, 0.04, 40]} />
            <meshStandardMaterial color="#a9a294" roughness={0.4} metalness={0.3} />
          </mesh>
        </>
      )}
      <mesh geometry={throatGeometry} position={[BEZEL.x, BEZEL.y, BOARD_Z + OPENING_Z - 0.025]}>
        <meshStandardMaterial color="#1a1108" roughness={0.8} />
      </mesh>
      {trimGeometry && (
        <mesh geometry={trimGeometry.opening} position={[BEZEL.x, BEZEL.y, BOARD_Z + OPENING_Z - 0.02]} material={trimBrass.material} />
      )}

      {/* the cream set's glass: dark, filling the lip's opening round the
          picture (which, being a rectangle, sits inside its rounder outline) */}
      {pillowGlass && (
        <mesh geometry={pillowGlass} position={[BEZEL.x, BEZEL.y, TUBE_Z - 0.01]}>
          <meshPhysicalMaterial color="#000000" roughness={0.4} clearcoat={0.5} clearcoatRoughness={0.2} />
        </mesh>
      )}
      {/* the tube (DOM layer punched through the canvas) */}
      <ScreenSurface position={[BEZEL.x, BEZEL.y, TUBE_Z]} scale={screenScale} squircle={Boolean(BEZEL.pillow)} {...screen} />
      {/* its glow, for the dark lighting moods (intensity set by useFade) */}
      <pointLight ref={glowRef} position={[BEZEL.x, BEZEL.y, FRONT_Z + 1.3]} color={GLOW.color} intensity={0} distance={8} decay={2.2} />

      {/* domed glass: faint tint + environment reflections, then the window glare */}
      <group position={[BEZEL.x, BEZEL.y, TUBE_Z + 0.005]}>
        <mesh geometry={domeGeometry} raycast={() => null}>
          <meshPhysicalMaterial
            color={PALETTE.glass}
            transparent
            opacity={0.12}
            roughness={0.05}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.05}
            envMapIntensity={1.5}
            depthWrite={false}
          />
        </mesh>
        <mesh geometry={domeGeometry} position={[0, 0, 0.004]} raycast={() => null}>
          <meshBasicMaterial map={glareTexture} transparent opacity={0.3} depthWrite={false} />
        </mesh>
      </group>

      {/* the control panel right of the bezel: a chrome-trimmed metal column, or a
          wooden panel over a cloth grille */}
      {parts.panel && woodMesh(parts.panel, bezel)}
      <group position={[panel.x, panel.y ?? BEZEL.y, 0]}>
        {panel.kind === 'column' && (
          <>
            <mesh geometry={columnTrimGeometry} position={[0, 0, BOARD_Z - 0.01]} castShadow>
              <Silver color="#c6c6c1" roughness={0.28} />
            </mesh>
            <mesh position={[0, 0, PANEL_Z - 0.02]} receiveShadow>
              {/* runs just under the trim's inner edge, so no gap shows */}
              <boxGeometry args={[panel.w - 0.03, BEZEL.h - 0.03, 0.04]} />
              <meshStandardMaterial color={PALETTE.panel.light} roughness={0.45} metalness={0.6} />
            </mesh>
          </>
        )}

        {/* on wood, the knobs' numbers are printed on dark escutcheons ringed in brass */}
        {panel.escutcheons &&
          Object.entries(panel.escutcheons).map(([knob, r]) => [panel[knob], r]).map(([[x, y], r]) => (
            <group key={x} position={[x, y, PANEL_Z]}>
              <mesh position={[0, 0, 0.001]} receiveShadow>
                <circleGeometry args={[r, 64]} />
                <meshStandardMaterial color="#1c140c" roughness={0.5} metalness={0.3} />
              </mesh>
              <mesh position={[0, 0, 0.0015]} material={trimBrass?.material}>
                <ringGeometry args={[r, r + 0.025, 64]} />
                {!trimBrass && <meshStandardMaterial {...BRASS} />}
              </mesh>
            </group>
          ))}

        <Knob3D
          position={[...panel.channel, PANEL_Z]}
          // a bar handle as small as the volume dial's, on the bigger dial
          radius={panel.knobs?.style === 'bar' ? volumeKnob.radius : channelKnob.radius}
          height={0.2}
          angleDeg={dialPosition * CHANNEL_DETENT}
          onDelta={handleChannelDelta}
          onDragStart={startDrag}
          onDragEnd={endDrag}
          finish={knobFinish}
          style={panel.knobs?.style}
          material={trimBrass?.material}
          ridgeCount={dish ? 72 : undefined}
          label={
            dish ? (
              // a fixed brass notch over the dish, the channel's number under it
              <mesh position={[0, channelKnob.radius + 0.055, 0.004]} rotation={[0, 0, -Math.PI / 2]}>
                <circleGeometry args={[0.04, 3]} />
                <meshStandardMaterial {...BRASS} />
              </mesh>
            ) : (
              <Plate texture={channelRingTexture} position={[0, 0, 0.004]} size={[channelKnob.ring, channelKnob.ring]} />
            )
          }
          face={dish && <Plate texture={dishNumbersTexture} position={[0, 0, 0]} size={[channelKnob.radius * 1.94, channelKnob.radius * 1.94]} />}
        />

        <Knob3D
          position={[...panel.volume, PANEL_Z]}
          radius={volumeKnob.radius}
          height={volumeKnob.height}
          angleDeg={volume * VOLUME_SWEEP - VOLUME_SWEEP / 2}
          onDelta={handleVolumeDelta}
          onDragStart={startDrag}
          onDragEnd={endDrag}
          ridgeCount={volumeKnob.ridges}
          finish={knobFinish}
          style={panel.knobs?.style}
          material={trimBrass?.material}
          label={!dish && <Plate texture={volumeTicksTexture} position={[0, 0, 0.004]} size={[volumeKnob.ticks, volumeKnob.ticks]} />}
          face={dish && <DishIndex radius={volumeKnob.radius} />}
        />

        {/* the speaker: perforated metal, or grille cloth in a dark surround (on
            the cream set it's the rail's louvres) */}
        {trimGeometry?.grille && (
          <mesh geometry={trimGeometry.grille} position={[0, panel.speaker.y, PANEL_Z - 0.006]} material={trimBrass.material} castShadow />
        )}
        {panel.kind === 'grille' && (
          <mesh position={[0, panel.speaker.y, PANEL_Z + 0.001]}>
            <planeGeometry args={[panel.speaker.w + 0.06, panel.speaker.h + 0.06]} />
            <meshStandardMaterial color="#1e150c" roughness={0.9} />
          </mesh>
        )}
        {panel.speaker && (
          <mesh position={[0, panel.speaker.y, PANEL_Z + 0.002]} receiveShadow>
            <planeGeometry args={[panel.speaker.w, panel.speaker.h]} />
            {panel.kind === 'grille' ? (
              <meshStandardMaterial map={speakerTexture} roughness={0.95} />
            ) : (
              <meshStandardMaterial map={speakerTexture} roughness={0.55} metalness={0.5} />
            )}
          </mesh>
        )}

        {/* power: a push-button, latched in while on (cream) */}
        {panel.power.kind === 'button' && (
          <PushButton position={[...powerAt, PANEL_Z]} finish={rail.buttons ?? 'grey'} pressed={isOn} onPress={onPowerToggle} />
        )}
        {/* or a slide switch: right for on */}
        {panel.power.kind !== 'button' && (
        <group
          position={[...powerAt, PANEL_Z]}
          onClick={handlePowerClick}
          onPointerOver={handleSwitchOver}
          onPointerOut={handleSwitchOut}
        >
          <mesh position={[0, 0, 0.005]}>
            <boxGeometry args={[0.44, 0.12, 0.01]} />
            <meshStandardMaterial color="#0e0e0d" roughness={0.8} />
          </mesh>
          {/* ribbed silver slider */}
          <mesh position={[isOn ? 0.07 : -0.07, 0, 0.03]} castShadow>
            <boxGeometry args={[0.24, 0.09, 0.05]} />
            <Silver
              color={silverColor}
              map={sliderRibs}
              bumpMap={sliderRibs}
              bumpScale={1.5}
              emissive="#ffffff"
              emissiveIntensity={switchHovered ? 0.08 : 0}
            />
          </mesh>
        </group>
        )}
      </group>

      {/* lower rail: badge, tuning strip, TV/VCR selector, louvres, heart, play lever,
          pilot lamp, brightness knob; in a groove routed into the board, or on a
          brass strip */}
      <group position={[0, rail.y, BOARD_Z]}>
        {rail.kind === 'groove' && (
          <mesh geometry={railGrooveGeometry} position={[0, 0, 0.001]}>
            <meshStandardMaterial color="#1a0e05" roughness={0.9} />
          </mesh>
        )}
        {/* brushed brass, its edges eased so they catch the light */}
        {rail.kind === 'brass' && (
          <mesh geometry={railBrassGeometry} position={[0, 0, -0.012]} material={railBrass.material} receiveShadow />
        )}

        {/* MENU: a push-button that latches in while SETUP is open */}
        <PushButton
          position={[...at(rail.menu), 0]}
          finish={rail.buttons ?? (darkMetal ? 'darkSilver' : undefined)}
          pressed={Boolean(menuOpen)}
          onPress={onMenuToggle}
        />
        <Plate texture={badgeTexture} position={[...at(rail.badge), 0.003]} size={[0.567, 0.17]} />

        {/* the tuning strip; a narrower one is scaled down whole, keeping the
            lettering's proportions */}
        <group position={[...at(rail.tuning), 0]} scale={[tuningW / 2.4, tuningW / 2.4, 1]}>
          <mesh position={[0, 0, -0.005]}>
            <boxGeometry args={[2.4, 0.28, 0.02]} />
            <meshStandardMaterial color="#0d0804" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0.008]}>
            <planeGeometry args={[2.3, 0.2]} />
            <meshBasicMaterial map={tuningTexture} toneMapped={false} />
          </mesh>
        </group>

        {/* TV/VCR input selector: a slide switch, left for the broadcast, with
            the ON AIR lamp above it lit while live (and the set is on) */}
        <group position={[...at(rail.input), 0]}>
          <mesh position={[0, inputStyle.onAir, 0.008]}>
            <boxGeometry args={[inputStyle.onAirW, 0.075, 0.012]} />
            {/* colour and glow set by useFade */}
            <meshStandardMaterial ref={onAirLampRef} emissive="#ff3a28" roughness={0.4} />
          </mesh>
          <Plate texture={onAirTexture} position={[0, inputStyle.onAir, 0.0145]} size={[0.2, 0.0625]} />
          <pointLight ref={onAirLightRef} position={[0, inputStyle.onAir, 0.2]} color="#ff3a28" distance={0.6} />

          <group position={[0, inputStyle.toggle, 0]} onClick={handleInputClick} onPointerOver={handleInputOver} onPointerOut={handleInputOut}>
            <mesh position={[0, 0, 0.004]}>
              <boxGeometry args={[0.3, 0.09, 0.012]} />
              <meshStandardMaterial color="#0e0e0d" roughness={0.8} />
            </mesh>
            {/* ribbed silver slider, like the power switch's */}
            <mesh position={[broadcast ? -0.07 : 0.07, 0, 0.02]} castShadow>
              <boxGeometry args={[0.13, 0.06, 0.03]} />
              <Silver
                color={silverColor}
                map={inputRibs}
                bumpMap={inputRibs}
                bumpScale={1.5}
                emissive="#ffffff"
                emissiveIntensity={inputHovered ? 0.08 : 0}
              />
            </mesh>
          </group>
          <Plate texture={inputLabelTexture} position={[0, inputStyle.labels, 0.003]} size={[0.32, 0.072]} />
        </group>

        {Array.from({ length: louvres.n }, (_, i) => (
          <mesh key={i} position={[louvres.x, louvres.y + ((louvres.n - 1) / 2 - i) * louvres.pitch, 0.004]}>
            <boxGeometry args={[louvres.w, 0.026, 0.01]} />
            <meshStandardMaterial color="#140b04" roughness={0.9} />
          </mesh>
        ))}

        {/* the heart: a red push-button, latched in while the concert is hearted */}
        <PushButton
          position={[...at(rail.heart), 0]}
          finish="heart"
          pressed={hearted}
          disabled={!canHeart || !isOn}
          onPress={onHeartToggle}
        />

        {/* play/pause: a bat-handle toggle, up to play, down to pause */}
        <group position={[...at(rail.lever), 0]} onClick={handleLeverClick} onPointerOver={handleLeverOver} onPointerOut={handleLeverOut}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]} castShadow>
            <cylinderGeometry args={[0.07, 0.075, 0.04, 6]} />
            <Chrome color={chromeColor} roughness={0.3} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.05]}>
            <cylinderGeometry args={[0.035, 0.04, 0.03, 16]} />
            <Chrome color={chromeColor} roughness={0.25} />
          </mesh>
          {/* pivot: +x rotation swings the handle from pointing up toward the viewer */}
          <group position={[0, 0, 0.06]} rotation={[paused ? Math.PI - LEVER_TILT : LEVER_TILT, 0, 0]}>
            <mesh position={[0, LEVER.length / 2, 0]} castShadow>
              <cylinderGeometry args={[LEVER.tip, LEVER.base, LEVER.length, 16]} />
              <Chrome color={chromeColor} roughness={0.2} emissive="#ffffff" emissiveIntensity={leverHovered ? 0.08 : 0} />
            </mesh>
            <mesh position={[0, LEVER.length, 0]} castShadow>
              <sphereGeometry args={[0.032, 20, 16]} />
              <Chrome color={chromeColor} roughness={0.15} emissive="#ffffff" emissiveIntensity={leverHovered ? 0.08 : 0} />
            </mesh>
          </group>
        </group>

        <mesh position={[...at(rail.lamp), 0.04]}>
          <sphereGeometry args={[0.05, 24, 24]} />
          {/* the pilot lamp: colour and glow set by useFade */}
          <meshStandardMaterial ref={pilotLampRef} emissive={PALETTE.amber} roughness={0.3} />
        </mesh>
        <pointLight ref={pilotLightRef} position={[...at(rail.lamp), 0.25]} color={PALETTE.amber} distance={1} />

        {/* brightness: a small knob, or a bar handle like the dials', in the
            play lever's chrome so it reads against the brass rail */}
        <Knob3D
          position={[...at(rail.brightness), 0]}
          // a bar a little bigger than the knob, as on the 2D set; a dish
          // (with an index line) the cabinet's size
          radius={panel.knobs?.brightness?.radius ?? (panel.knobs?.style === 'bar' ? 0.135 : 0.096)}
          height={0.08}
          finish={knobFinish ?? 'black'}
          ridgeCount={dish ? 32 : 30}
          style={panel.knobs?.style}
          face={dish && <DishIndex radius={panel.knobs.brightness.radius} />}
          material={barChrome}
          angleDeg={((brightness - BRIGHTNESS_MIN) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN)) * VOLUME_SWEEP - VOLUME_SWEEP / 2}
          onDelta={handleBrightnessDelta}
          onDragStart={startDrag}
          onDragEnd={endDrag}
        />
      </group>

      {/* on the cream set, seated on the shell's curved top (sunk a little, so
          its ball mount never shows a gap) */}
      <Antenna
        position={[
          spec.antenna.x,
          shell ? shellTopAt(layout, shell, spec.antenna.x, spec.antenna.z) - 0.02 : TOP_FACE,
          spec.antenna.z,
        ]}
        onBusy={onKnobDragging}
        {...antenna}
      />

      <GuideStack position={[GUIDE.x, TOP_FACE, GUIDE.z]} open={guideOpen} onOpen={onGuideOpen} />

      {/* legs: splayed slabs, or pencil legs */}
      {parts.legs?.map((leg, i) => (
        <mesh key={i} geometry={leg.geometry} position={leg.position} material={bodyShade} castShadow receiveShadow />
      ))}
      {spec.legs.kind === 'pencil' && <PencilLegs layout={layout} material={bodyShade} brass={trimBrass?.material} />}
    </group>
  );
};

export default TVModel;

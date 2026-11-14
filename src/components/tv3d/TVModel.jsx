import { useRef, useCallback, useState, useEffect } from 'react';
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
import { Plate, Chrome, Silver, PushButton, GuideStack, Antenna } from './controls';
import { LAMP } from './lamps';
import {
  PALETTE,
  makeWoodTexture,
  makeWoodMaterial,
  boxProjectUVs,
  makeLoftGeometry,
  makeTaperedLegGeometry,
  makePerforatedTexture,
  makeClothTexture,
  makeKnurlTexture,
  makeGlareTexture,
  makeLabelTexture,
  makeChannelRingTexture,
  makeVolumeTicksTexture,
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

/** Bezel profile, outer edge first. z is relative to the board's face. */
const bezelRings = ({ BEZEL, OPENING, OPENING_Z }) => {
  const { w, h } = BEZEL;
  const faceW = w - 0.16;
  const faceH = h - 0.16;
  const rings = [
    { w, h, r: 0.1, z: -0.03 }, // tucked under the board
    { w, h, r: 0.1, z: 0.05 }, // outer wall
    { w: w - 0.015, h: h - 0.015, r: 0.095, z: 0.075 }, // eased edge
    { w: w - 0.05, h: h - 0.05, r: 0.085, z: 0.085 },
    { w: faceW, h: faceH, r: 0.1, z: 0.085 }, // flat face
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
      r: 0.1 + (OPENING.r - 0.1) * t,
      z: 0.085 + (OPENING_Z - 0.085) * down,
    });
  }
  rings.push({ ...OPENING, z: OPENING_Z - 0.08 }); // short throat behind the opening
  return rings;
};

/**
 * Every wooden part of a cabinet, with UVs box-projected in world space
 * (`at` is where the mesh sits) so the grain runs continuously from one part
 * to the next.
 */
const makeWoodParts = (layout) => {
  const { spec, CABINET, BOARD, BOARD_Z, FRONT_Z, BODY_FRONT_Z, BODY, TOP_Y, BOTTOM_Y, BEZEL } = layout;
  const wood = (geometry, at, span = 7) => ({ geometry: boxProjectUVs(geometry, { span, offset: at }), position: at });
  const { top, plinth, panel, legs } = spec;
  const parts = {
    body: wood(new RoundedBoxGeometry(CABINET.w, CABINET.h, BODY.d, 4, spec.bodyRadius), [0, 0, BODY.z]),
    rim: wood(
      makeFrameGeometry({
        outerW: CABINET.w - 0.04,
        outerH: CABINET.h - 0.04,
        innerW: BOARD.w + 0.04,
        innerH: BOARD.h + 0.04,
        depth: FRONT_Z - BODY_FRONT_Z + 0.06,
        radius: 0.04,
        innerRadius: 0.03,
        bevelSize: 0.02,
        bevelSegments: 3,
      }),
      // starts inside the body so the back bevel is buried and the sides read as one board
      [0, 0, BODY_FRONT_Z - 0.08]
    ),
    board: wood(
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
    top: wood(new RoundedBoxGeometry(CABINET.w + top.w, top.thickness, CABINET.d + top.d, 3, top.radius), [0, TOP_Y + top.y, 0]),
    bezel: wood(makeLoftGeometry(bezelRings(layout), 12), [BEZEL.x, BEZEL.y, BOARD_Z], 5),
  };
  if (plinth) {
    parts.plinth = wood(
      new RoundedBoxGeometry(CABINET.w + plinth.w, plinth.height, CABINET.d + plinth.d, 2, 0.03),
      [0, BOTTOM_Y + plinth.y, 0]
    );
  }
  // A grille panel is a board of the bezel's wood, standing proud of the front board.
  if (panel.kind === 'grille') {
    parts.panel = wood(new RoundedBoxGeometry(panel.w, BEZEL.h, 0.06, 2, 0.02), [panel.x, BEZEL.y, BOARD_Z + 0.01], 5);
  }
  if (legs.kind === 'slab') {
    // one per corner: each leans out toward its own corner
    parts.legs = LEG_CORNERS.map(([sx, sz]) =>
      wood(
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

/** Thin round legs, splayed out toward their corners, with brass ferrules. */
const PencilLegs = ({ layout, material }) => {
  const { legs, floorY } = layout.spec;
  const topY = layout.BOTTOM_Y + legs.top;
  // Long enough, once splayed, for the ferrule to stand on the floor.
  const length = (topY - floorY) / (Math.cos(legs.splayX) * Math.cos(legs.splayZ));
  const [rTop, rFoot] = legs.radius;
  return LEG_CORNERS.map(([sx, sz]) => (
    <group key={`${sx}${sz}`} position={[sx * legs.spreadX, topY, sz * legs.spreadZ]} rotation={[-sz * legs.splayZ, 0, sx * legs.splayX]}>
      {/* the mounting plate under the body */}
      <mesh position={[0, -0.012, 0]} material={material} castShadow>
        <cylinderGeometry args={[rTop * 1.5, rTop * 1.5, 0.024, 20]} />
      </mesh>
      <mesh position={[0, -length / 2, 0]} material={material} castShadow receiveShadow>
        <cylinderGeometry args={[rTop, rFoot, length, 20]} />
      </mesh>
      <mesh position={[0, -length + legs.ferrule / 2, 0]} castShadow>
        <cylinderGeometry args={[rFoot * 1.08, rFoot * 1.02, legs.ferrule, 20]} />
        <meshStandardMaterial {...BRASS} roughness={0.3} />
      </mesh>
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
  const { spec, CABINET, BOARD, BOARD_Z, FRONT_Z, TOP_FACE, BEZEL, OPENING, OPENING_Z, TUBE_Z, GUIDE } = layout;
  const { panel, rail } = spec;
  const { model, woods } = cabinetFor(layout.key);

  // --- materials ---------------------------------------------------------
  // "body" is the cabinet's wood (walnut on the NP-R1), "bezel" the bezel's
  // (honey); a grille panel is the bezel's wood too.
  const bodyWood = useDisposable(() => makeWoodTexture(woods.body, 'body'), [woods.body]);
  const bezelWood = useDisposable(() => makeWoodTexture(woods.bezel, 'bezel'), [woods.bezel]);
  const body = useDisposable(() => makeWoodMaterial(bodyWood), [bodyWood]);
  const bodyShade = useDisposable(() => makeWoodMaterial(bodyWood, { tint: '#bfae9c', clearcoat: 0.35 }), [bodyWood]);
  const bezel = useDisposable(() => makeWoodMaterial(bezelWood, { clearcoat: 0.7 }), [bezelWood]);
  const parts = useDisposable(() => makeWoodParts(layout), [layout]);

  const sliderRibs = useDisposable(() => makeKnurlTexture(9), []);
  // The TV/VCR slider is ~half the power slider's width: half the ribs, same pitch.
  const inputRibs = useDisposable(() => makeKnurlTexture(5), []);
  const onAir = broadcast && isOn; // the ON AIR lamp: live, and the set switched on

  // --- lamps: ON AIR and the pilot lamp fade on and off ---------------------
  const onAirLampRef = useRef(null);
  const onAirLightRef = useRef(null);
  useFade(onAir ? 1 : 0, (k) => {
    if (onAirLampRef.current) {
      onAirLampRef.current.color.lerpColors(LAMP.onAir.off, LAMP.onAir.on, k);
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

  const speakerTexture = useDisposable(
    () => (panel.kind === 'grille' ? makeClothTexture() : makePerforatedTexture({ repeat: [10, 8] })),
    [panel.kind]
  );
  const glareTexture = useDisposable(makeGlareTexture, []);
  const backPanelTexture = useDisposable(makeBackPanelTexture, []);
  const channelRingTexture = useDisposable(makeChannelRingTexture, []);
  const volumeTicksTexture = useDisposable(makeVolumeTicksTexture, []);
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
    () => makeLabelTexture('ON AIR', { width: 256, height: 80, font: 'bold 52px "Courier New", monospace', color: '#ffe9e0', letterSpacing: 6 }),
    []
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
  const domeGeometry = useDisposable(() => makeDomeGeometry(SCREEN_W, SCREEN_H, 0.09), []);

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
  const PANEL_Z = panel.kind === 'column' ? BOARD_Z + 0.02 : BOARD_Z + 0.04;

  return (
    <group>
      {/* cabinet: body, raised front rim, recessed front board, top board, plinth */}
      {woodMesh(parts.body, body)}
      {woodMesh(parts.rim, body)}
      {woodMesh(parts.board, body, false)}
      {woodMesh(parts.top, body)}
      {parts.plinth && woodMesh(parts.plinth, bodyShade)}
      {/* the hardboard back, with the inspector's tag */}
      <mesh position={[0, 0, -CABINET.d / 2 - 0.003]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[CABINET.w - 0.3, CABINET.h - 0.3]} />
        {/* faintly self-lit: the lights are all in front, and the print should still read */}
        <meshStandardMaterial map={backPanelTexture} emissiveMap={backPanelTexture} emissive="#ffffff" emissiveIntensity={0.22} roughness={0.85} />
      </mesh>

      {/* the bezel, rolling down into the cabinet toward the tube */}
      {woodMesh(parts.bezel, bezel)}
      <mesh geometry={throatGeometry} position={[BEZEL.x, BEZEL.y, BOARD_Z + OPENING_Z - 0.025]}>
        <meshStandardMaterial color="#1a1108" roughness={0.8} />
      </mesh>

      {/* the tube (DOM layer punched through the canvas) */}
      <ScreenSurface position={[BEZEL.x, BEZEL.y, TUBE_Z]} {...screen} />
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
      <group position={[panel.x, BEZEL.y, 0]}>
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

        {/* on a wooden panel, the knobs' numbers are printed on dark escutcheons
            ringed in brass */}
        {panel.kind === 'grille' &&
          [
            [panel.channel, 0.6],
            [panel.volume, 0.5],
          ].map(([[x, y], r]) => (
            <group key={x} position={[x, y, PANEL_Z]}>
              <mesh position={[0, 0, 0.001]} receiveShadow>
                <circleGeometry args={[r, 64]} />
                <meshStandardMaterial color="#1c140c" roughness={0.5} metalness={0.3} />
              </mesh>
              <mesh position={[0, 0, 0.0015]}>
                <ringGeometry args={[r, r + 0.025, 64]} />
                <meshStandardMaterial {...BRASS} />
              </mesh>
            </group>
          ))}

        <Knob3D
          position={[...panel.channel, PANEL_Z]}
          radius={0.32}
          height={0.2}
          angleDeg={dialPosition * CHANNEL_DETENT}
          onDelta={handleChannelDelta}
          onDragStart={startDrag}
          onDragEnd={endDrag}
          label={<Plate texture={channelRingTexture} position={[0, 0, 0.004]} size={[1.12, 1.12]} />}
        />

        <Knob3D
          position={[...panel.volume, PANEL_Z]}
          radius={0.3}
          height={0.19}
          angleDeg={volume * VOLUME_SWEEP - VOLUME_SWEEP / 2}
          onDelta={handleVolumeDelta}
          onDragStart={startDrag}
          onDragEnd={endDrag}
          ridgeCount={52}
          label={<Plate texture={volumeTicksTexture} position={[0, 0, 0.004]} size={[0.92, 0.92]} />}
        />

        {/* the speaker: perforated metal, or grille cloth in a dark surround */}
        {panel.kind === 'grille' && (
          <mesh position={[0, panel.speaker.y, PANEL_Z + 0.001]}>
            <planeGeometry args={[panel.speaker.w + 0.06, panel.speaker.h + 0.06]} />
            <meshStandardMaterial color="#1e150c" roughness={0.9} />
          </mesh>
        )}
        <mesh position={[0, panel.speaker.y, PANEL_Z + 0.002]} receiveShadow>
          <planeGeometry args={[panel.speaker.w, panel.speaker.h]} />
          {panel.kind === 'grille' ? (
            <meshStandardMaterial map={speakerTexture} roughness={0.95} />
          ) : (
            <meshStandardMaterial map={speakerTexture} roughness={0.55} metalness={0.5} />
          )}
        </mesh>

        {/* power: slide right for on */}
        <group
          position={[...panel.power, PANEL_Z]}
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
              map={sliderRibs}
              bumpMap={sliderRibs}
              bumpScale={1.5}
              emissive="#ffffff"
              emissiveIntensity={switchHovered ? 0.08 : 0}
            />
          </mesh>
        </group>
      </group>

      {/* lower rail: badge, tuning strip, TV/VCR selector, louvres, heart, play lever,
          pilot lamp, brightness knob; in a groove routed into the board, or on a
          brass strip */}
      <group position={[0, rail.y, BOARD_Z]}>
        {rail.kind === 'groove' ? (
          <mesh geometry={railGrooveGeometry} position={[0, 0, 0.001]}>
            <meshStandardMaterial color="#1a0e05" roughness={0.9} />
          </mesh>
        ) : (
          <mesh position={[0, 0, -0.008]} receiveShadow>
            <boxGeometry args={[BOARD.w - 0.2, 0.42, 0.02]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
        )}

        {/* MENU: a silver push-button that latches in while SETUP is open */}
        <PushButton position={[rail.menu, 0, 0]} pressed={Boolean(menuOpen)} onPress={onMenuToggle} />
        <Plate texture={badgeTexture} position={[rail.badge, 0, 0.003]} size={[0.567, 0.17]} />

        <mesh position={[rail.tuning, 0, -0.005]}>
          <boxGeometry args={[2.4, 0.28, 0.02]} />
          <meshStandardMaterial color="#0d0804" roughness={0.9} />
        </mesh>
        <mesh position={[rail.tuning, 0, 0.008]}>
          <planeGeometry args={[2.3, 0.2]} />
          <meshBasicMaterial map={tuningTexture} toneMapped={false} />
        </mesh>

        {/* TV/VCR input selector: a slide switch, left for the broadcast, with
            the ON AIR lamp above it lit while live (and the set is on) */}
        <group position={[rail.input, 0, 0]}>
          <mesh position={[0, 0.15, 0.008]}>
            <boxGeometry args={[0.24, 0.075, 0.012]} />
            {/* colour and glow set by useFade */}
            <meshStandardMaterial ref={onAirLampRef} emissive="#ff3a28" roughness={0.4} />
          </mesh>
          <Plate texture={onAirTexture} position={[0, 0.15, 0.0145]} size={[0.2, 0.0625]} />
          <pointLight ref={onAirLightRef} position={[0, 0.15, 0.2]} color="#ff3a28" distance={0.6} />

          <group onClick={handleInputClick} onPointerOver={handleInputOver} onPointerOut={handleInputOut}>
            <mesh position={[0, 0, 0.004]}>
              <boxGeometry args={[0.3, 0.09, 0.012]} />
              <meshStandardMaterial color="#0e0e0d" roughness={0.8} />
            </mesh>
            {/* ribbed silver slider, like the power switch's */}
            <mesh position={[broadcast ? -0.07 : 0.07, 0, 0.02]} castShadow>
              <boxGeometry args={[0.13, 0.06, 0.03]} />
              <Silver
                map={inputRibs}
                bumpMap={inputRibs}
                bumpScale={1.5}
                emissive="#ffffff"
                emissiveIntensity={inputHovered ? 0.08 : 0}
              />
            </mesh>
          </group>
          <Plate texture={inputLabelTexture} position={[0, -0.12, 0.003]} size={[0.32, 0.072]} />
        </group>

        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i} position={[rail.louvres.x, 0.12 - i * 0.06, 0.004]}>
            <boxGeometry args={[rail.louvres.w, 0.026, 0.01]} />
            <meshStandardMaterial color="#140b04" roughness={0.9} />
          </mesh>
        ))}

        {/* the heart: a red push-button, latched in while the concert is hearted */}
        <PushButton
          position={[rail.heart, 0, 0]}
          finish="heart"
          pressed={hearted}
          disabled={!canHeart || !isOn}
          onPress={onHeartToggle}
        />

        {/* play/pause: a bat-handle toggle, up to play, down to pause */}
        <group position={[rail.lever, 0, 0]} onClick={handleLeverClick} onPointerOver={handleLeverOver} onPointerOut={handleLeverOut}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]} castShadow>
            <cylinderGeometry args={[0.07, 0.075, 0.04, 6]} />
            <Chrome roughness={0.3} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.05]}>
            <cylinderGeometry args={[0.035, 0.04, 0.03, 16]} />
            <Chrome roughness={0.25} />
          </mesh>
          {/* pivot: +x rotation swings the handle from pointing up toward the viewer */}
          <group position={[0, 0, 0.06]} rotation={[paused ? Math.PI - LEVER_TILT : LEVER_TILT, 0, 0]}>
            <mesh position={[0, LEVER.length / 2, 0]} castShadow>
              <cylinderGeometry args={[LEVER.tip, LEVER.base, LEVER.length, 16]} />
              <Chrome roughness={0.2} emissive="#ffffff" emissiveIntensity={leverHovered ? 0.08 : 0} />
            </mesh>
            <mesh position={[0, LEVER.length, 0]} castShadow>
              <sphereGeometry args={[0.032, 20, 16]} />
              <Chrome roughness={0.15} emissive="#ffffff" emissiveIntensity={leverHovered ? 0.08 : 0} />
            </mesh>
          </group>
        </group>

        <mesh position={[rail.lamp, 0, 0.04]}>
          <sphereGeometry args={[0.05, 24, 24]} />
          {/* the pilot lamp: colour and glow set by useFade */}
          <meshStandardMaterial ref={pilotLampRef} emissive={PALETTE.amber} roughness={0.3} />
        </mesh>
        <pointLight ref={pilotLightRef} position={[rail.lamp, 0, 0.25]} color={PALETTE.amber} distance={1} />

        {/* brightness */}
        <Knob3D
          position={[rail.brightness, 0, 0]}
          radius={0.096}
          height={0.08}
          finish="black"
          ridgeCount={30}
          angleDeg={((brightness - BRIGHTNESS_MIN) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN)) * VOLUME_SWEEP - VOLUME_SWEEP / 2}
          onDelta={handleBrightnessDelta}
          onDragStart={startDrag}
          onDragEnd={endDrag}
        />
      </group>

      <Antenna position={[spec.antenna.x, TOP_FACE, spec.antenna.z]} onBusy={onKnobDragging} {...antenna} />

      <GuideStack position={[GUIDE.x, TOP_FACE, GUIDE.z]} open={guideOpen} onOpen={onGuideOpen} />

      {/* legs: splayed slabs, or pencil legs */}
      {parts.legs?.map((leg, i) => (
        <mesh key={i} geometry={leg.geometry} position={leg.position} material={bodyShade} castShadow receiveShadow />
      ))}
      {spec.legs.kind === 'pencil' && <PencilLegs layout={layout} material={bodyShade} />}
    </group>
  );
};

export default TVModel;

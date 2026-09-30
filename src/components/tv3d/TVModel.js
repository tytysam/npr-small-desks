import React, { useMemo, useRef, useCallback, useState } from 'react';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import Knob3D from './Knob3D';
import useDisposable from './useDisposable';
import { BRIGHTNESS_MIN, BRIGHTNESS_MAX } from '../../js/picture';
import ScreenSurface, { SCREEN_W, SCREEN_H } from './ScreenSurface';
import {
  PALETTE,
  makeWoodTexture,
  makeWoodMaterial,
  boxProjectUVs,
  makeLoftGeometry,
  makeTaperedLegGeometry,
  makePerforatedTexture,
  makeGlareTexture,
  makeLabelTexture,
  makeChannelRingTexture,
  makeVolumeTicksTexture,
  makeFrameGeometry,
  makeDomeGeometry,
} from './materials';

// Layout (world units). The cabinet is centred on the origin; +Z faces the viewer.
//
// Depth, front to back: the outer rim of the cabinet (FRONT_Z) → the recessed
// front board (BOARD_Z) that carries the bezel, control column and rail → the
// tube, sunk behind the bezel's rolled opening → the cabinet body behind it.
const CABINET = { w: 6.5, h: 4.7, d: 3.4 };
const FRONT_Z = CABINET.d / 2;
const RIM = 0.18;
const BOARD = { w: CABINET.w - RIM * 2, h: CABINET.h - RIM * 2 };
const BOARD_Z = FRONT_Z - 0.12;
const BODY_FRONT_Z = FRONT_Z - 0.5;
const BODY = { d: BODY_FRONT_Z + CABINET.d / 2, z: (BODY_FRONT_Z - CABINET.d / 2) / 2 };
const TOP_Y = CABINET.h / 2;
const BOTTOM_Y = -CABINET.h / 2;

// Honey-wood bezel: a narrow flat face that rolls over into a cove and sinks
// to a pillow-shaped opening just inside the tube's edge.
const BEZEL = { x: -0.73, y: 0.35, w: 4.44, h: 3.44 };
const OPENING = { w: SCREEN_W - 0.1, h: SCREEN_H - 0.1, r: 0.52 };
const OPENING_Z = -0.13; // relative to BOARD_Z
const TUBE_Z = BOARD_Z + OPENING_Z - 0.02;

const COLUMN = { x: 2.29, y: BEZEL.y, w: 1.32, h: BEZEL.h };
const PANEL_Z = BOARD_Z + 0.02; // face of the column's inset panel
const RAIL_Y = -1.77;

const LEG = { width: 0.46, depth: 0.22, length: 0.85, spreadX: 2.7, spreadZ: 1.2, splayX: 0.3, splayZ: 0.12 };

const LEVER = { length: 0.17, base: 0.018, tip: 0.013 };
const LEVER_TILT = 0.5; // radians forward of vertical

const VOLUME_SWEEP = 270;
const CHANNEL_DETENT = 30;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Bezel profile, outer edge first. z is relative to the board's face. */
const bezelRings = () => {
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
 * Every wooden part, with UVs box-projected in world space (`at` is where the
 * mesh sits) so the grain runs continuously from one part to the next.
 */
const makeWoodParts = () => {
  const wood = (geometry, at, span = 7) => ({ geometry: boxProjectUVs(geometry, { span, offset: at }), position: at });
  return {
    body: wood(new RoundedBoxGeometry(CABINET.w, CABINET.h, BODY.d, 4, 0.06), [0, 0, BODY.z]),
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
    top: wood(new RoundedBoxGeometry(CABINET.w + 0.16, 0.12, CABINET.d + 0.12, 3, 0.04), [0, TOP_Y + 0.04, 0]),
    plinth: wood(new RoundedBoxGeometry(CABINET.w - 0.3, 0.14, CABINET.d - 0.4, 2, 0.03), [0, BOTTOM_Y - 0.06, 0]),
    bezel: wood(makeLoftGeometry(bezelRings(), 12), [BEZEL.x, BEZEL.y, BOARD_Z], 5),
    leg: boxProjectUVs(makeTaperedLegGeometry(LEG), { span: 2 }),
  };
};

const Plate = ({ texture, position, size, rotation }) => (
  <mesh position={position} rotation={rotation}>
    <planeGeometry args={size} />
    <meshBasicMaterial map={texture} transparent depthWrite={false} />
  </mesh>
);

const Chrome = (props) => <meshStandardMaterial color={PALETTE.chrome} metalness={1} roughness={0.2} {...props} />;

/** Three-section telescoping rod on a ball mount, leaning back slightly. */
const Antenna = ({ position }) => {
  const sections = [
    { r: 0.03, len: 0.62 },
    { r: 0.023, len: 0.58 },
    { r: 0.016, len: 0.52 },
  ];
  let y = 0.05;
  return (
    <group position={position} rotation={[-0.18, 0, -0.04]}>
      <mesh castShadow>
        <sphereGeometry args={[0.11, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Chrome />
      </mesh>
      {sections.map(({ r, len }, i) => {
        const cy = y + len / 2;
        y += len - 0.04;
        return (
          <group key={i}>
            <mesh position={[0, cy, 0]} castShadow>
              <cylinderGeometry args={[r, r, len, 16]} />
              <Chrome roughness={0.15} />
            </mesh>
            <mesh position={[0, cy + len / 2 - 0.02, 0]}>
              <cylinderGeometry args={[r * 1.35, r * 1.35, 0.04, 16]} />
              <Chrome roughness={0.3} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, y + 0.04, 0]}>
        <sphereGeometry args={[0.028, 16, 12]} />
        <Chrome />
      </mesh>
    </group>
  );
};

/**
 * The console itself. Receives the same props as the 2D <TV/> plus
 * `onKnobDragging`, which the scene uses to pause orbiting mid-drag.
 */
const TVModel = ({
  video,
  volume,
  onVolumeChange,
  onChannelChange,
  isLoading,
  error,
  artistName,
  dialPosition,
  brightness,
  onBrightnessChange,
  isOn,
  onPowerToggle,
  paused,
  onPauseToggle,
  playing,
  resumeAt,
  onProgress,
  onEnded,
  osd,
  onKnobDragging,
}) => {
  // --- materials ---------------------------------------------------------
  const walnutWood = useDisposable(() => makeWoodTexture({ palette: PALETTE.walnut }), []);
  // The bezel is cut farther from the pith, so its grain runs straighter and finer.
  const honeyWood = useDisposable(
    () => makeWoodTexture({ palette: PALETTE.honey, seed: 42, size: 512, ringPx: 11, pithDepth: 0.3, taper: 0.2, warp: 1.2 }),
    []
  );
  const walnut = useDisposable(() => makeWoodMaterial(walnutWood), [walnutWood]);
  const walnutShade = useDisposable(() => makeWoodMaterial(walnutWood, { tint: '#bfae9c', clearcoat: 0.35 }), [walnutWood]);
  const honey = useDisposable(() => makeWoodMaterial(honeyWood, { clearcoat: 0.7 }), [honeyWood]);
  const parts = useDisposable(makeWoodParts, []);

  const perforated = useDisposable(() => makePerforatedTexture({ repeat: [10, 8] }), []);
  const glareTexture = useDisposable(makeGlareTexture, []);
  const channelRingTexture = useDisposable(makeChannelRingTexture, []);
  const volumeTicksTexture = useDisposable(makeVolumeTicksTexture, []);
  const badgeTexture = useDisposable(
    () =>
      makeLabelTexture('NPR', {
        width: 256,
        height: 96,
        font: 'bold 60px Georgia, serif',
        color: '#24130a',
        letterSpacing: 10,
      }),
    []
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
    []
  );
  const columnTrimGeometry = useDisposable(
    () =>
      makeFrameGeometry({
        outerW: COLUMN.w,
        outerH: COLUMN.h,
        innerW: COLUMN.w - 0.12,
        innerH: COLUMN.h - 0.12,
        depth: 0.05,
        radius: 0.06,
        innerRadius: 0.03,
        bevelSize: 0.012,
        bevelSegments: 2,
      }),
    []
  );
  const railGrooveGeometry = useDisposable(
    () =>
      makeFrameGeometry({
        outerW: BOARD.w - 0.2,
        outerH: 0.6,
        innerW: BOARD.w - 0.24,
        innerH: 0.56,
        depth: 0.004,
        radius: 0.04,
        innerRadius: 0.03,
        bevelSize: 0,
      }),
    []
  );
  const domeGeometry = useDisposable(() => makeDomeGeometry(SCREEN_W, SCREEN_H, 0.09), []);

  // --- volume knob -------------------------------------------------------
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const handleVolumeDelta = useCallback(
    (delta) => {
      const next = clamp01(volumeRef.current + delta / VOLUME_SWEEP);
      if (next !== volumeRef.current) onVolumeChange(next);
    },
    [onVolumeChange]
  );

  // --- brightness knob ---------------------------------------------------
  const brightnessRef = useRef(brightness);
  brightnessRef.current = brightness;
  const handleBrightnessDelta = useCallback(
    (delta) => onBrightnessChange(brightnessRef.current + (delta / VOLUME_SWEEP) * (BRIGHTNESS_MAX - BRIGHTNESS_MIN)),
    [onBrightnessChange]
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

  const legs = useMemo(
    () =>
      [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz]) => ({
        position: [sx * LEG.spreadX, BOTTOM_Y - 0.12, sz * LEG.spreadZ],
        // splay the feet outward: +z rotation swings the foot toward +x, +x rotation toward -z
        rotation: [-sz * LEG.splayZ, 0, sx * LEG.splayX],
      })),
    []
  );

  const woodMesh = (part, material, shadows = true) => (
    <mesh geometry={part.geometry} position={part.position} material={material} castShadow={shadows} receiveShadow />
  );

  return (
    <group>
      {/* cabinet: body, raised front rim, recessed front board, top board, plinth */}
      {woodMesh(parts.body, walnut)}
      {woodMesh(parts.rim, walnut)}
      {woodMesh(parts.board, walnut, false)}
      {woodMesh(parts.top, walnut)}
      {woodMesh(parts.plinth, walnutShade)}

      {/* honey-wood bezel, rolling down into the cabinet toward the tube */}
      {woodMesh(parts.bezel, honey)}
      <mesh geometry={throatGeometry} position={[BEZEL.x, BEZEL.y, BOARD_Z + OPENING_Z - 0.025]}>
        <meshStandardMaterial color="#1a1108" roughness={0.8} />
      </mesh>

      {/* the tube (DOM layer punched through the canvas) */}
      <ScreenSurface
        position={[BEZEL.x, BEZEL.y, TUBE_Z]}
        video={video}
        volume={volume}
        playing={playing}
        isOn={isOn}
        brightness={brightness}
        isLoading={isLoading}
        error={error}
        resumeAt={resumeAt}
        onProgress={onProgress}
        onEnded={onEnded}
        osd={osd}
      />

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

      {/* control column: dark trim around an inset metal panel */}
      <group position={[COLUMN.x, COLUMN.y, 0]}>
        <mesh geometry={columnTrimGeometry} position={[0, 0, BOARD_Z - 0.01]} castShadow>
          <meshStandardMaterial color="#1c1b19" roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0, PANEL_Z - 0.02]} receiveShadow>
          <boxGeometry args={[COLUMN.w - 0.1, COLUMN.h - 0.1, 0.04]} />
          <meshStandardMaterial color={PALETTE.panel.light} roughness={0.45} metalness={0.6} />
        </mesh>

        <Knob3D
          position={[0, 1.12, PANEL_Z]}
          radius={0.32}
          height={0.2}
          angleDeg={dialPosition * CHANNEL_DETENT}
          onDelta={handleChannelDelta}
          onDragStart={startDrag}
          onDragEnd={endDrag}
          label={<Plate texture={channelRingTexture} position={[0, 0, 0.004]} size={[1.12, 1.12]} />}
        />

        <Knob3D
          position={[0, 0, PANEL_Z]}
          radius={0.3}
          height={0.19}
          angleDeg={volume * VOLUME_SWEEP - VOLUME_SWEEP / 2}
          onDelta={handleVolumeDelta}
          onDragStart={startDrag}
          onDragEnd={endDrag}
          ridgeCount={52}
          label={<Plate texture={volumeTicksTexture} position={[0, 0, 0.004]} size={[0.92, 0.92]} />}
        />

        {/* perforated speaker */}
        <mesh position={[0, -0.9, PANEL_Z + 0.002]} receiveShadow>
          <planeGeometry args={[1.02, 0.78]} />
          <meshStandardMaterial map={perforated} roughness={0.55} metalness={0.5} />
        </mesh>

        {/* power: slide right for on */}
        <group
          position={[0, -1.47, PANEL_Z]}
          onClick={handlePowerClick}
          onPointerOver={handleSwitchOver}
          onPointerOut={handleSwitchOut}
        >
          <mesh position={[0, 0, 0.005]}>
            <boxGeometry args={[0.44, 0.12, 0.01]} />
            <meshStandardMaterial color="#0e0e0d" roughness={0.8} />
          </mesh>
          <mesh position={[isOn ? 0.07 : -0.07, 0, 0.03]} castShadow>
            <boxGeometry args={[0.24, 0.09, 0.05]} />
            <Chrome roughness={0.35} emissive="#ffffff" emissiveIntensity={switchHovered ? 0.08 : 0} />
          </mesh>
        </group>
      </group>

      {/* lower rail: groove, badge, tuning strip, louvres, play lever, pilot lamp, brightness knob */}
      <group position={[0, RAIL_Y, BOARD_Z]}>
        <mesh geometry={railGrooveGeometry} position={[0, 0, 0.001]}>
          <meshStandardMaterial color="#1a0e05" roughness={0.9} />
        </mesh>

        <mesh position={[-2.75, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.13, 0.1, 32]} />
          <Chrome />
        </mesh>
        <mesh position={[-2.75, 0, 0.101]}>
          <circleGeometry args={[0.028, 16]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        <Plate texture={badgeTexture} position={[-2.33, 0, 0.003]} size={[0.46, 0.17]} />

        <mesh position={[-0.75, 0, -0.005]}>
          <boxGeometry args={[2.4, 0.28, 0.02]} />
          <meshStandardMaterial color="#0d0804" roughness={0.9} />
        </mesh>
        <mesh position={[-0.75, 0, 0.008]}>
          <planeGeometry args={[2.3, 0.2]} />
          <meshBasicMaterial map={tuningTexture} toneMapped={false} />
        </mesh>

        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i} position={[1.28, 0.12 - i * 0.06, 0.004]}>
            <boxGeometry args={[0.72, 0.026, 0.01]} />
            <meshStandardMaterial color="#140b04" roughness={0.9} />
          </mesh>
        ))}

        {/* play/pause: a bat-handle toggle, up to play, down to pause */}
        <group position={[1.9, 0, 0]} onClick={handleLeverClick} onPointerOver={handleLeverOver} onPointerOut={handleLeverOut}>
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

        <mesh position={[2.3, 0, 0.04]}>
          <sphereGeometry args={[0.05, 24, 24]} />
          <meshStandardMaterial
            color={isOn ? '#ffd08a' : '#5a3a12'}
            emissive={PALETTE.amber}
            emissiveIntensity={isOn ? 2.2 : 0.05}
            roughness={0.3}
          />
        </mesh>
        <pointLight position={[2.3, 0, 0.25]} color={PALETTE.amber} intensity={isOn ? 0.5 : 0} distance={1} />

        {/* brightness */}
        <Knob3D
          position={[2.72, 0, 0]}
          radius={0.12}
          height={0.1}
          finish="black"
          ridgeCount={30}
          angleDeg={((brightness - BRIGHTNESS_MIN) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN)) * VOLUME_SWEEP - VOLUME_SWEEP / 2}
          onDelta={handleBrightnessDelta}
          onDragStart={startDrag}
          onDragEnd={endDrag}
        />
      </group>

      <Antenna position={[1.9, TOP_Y + 0.1, -0.5]} />

      {/* splayed slab legs */}
      {legs.map((leg, i) => (
        <mesh key={i} geometry={parts.leg} material={walnutShade} position={leg.position} rotation={leg.rotation} castShadow />
      ))}
    </group>
  );
};

export default TVModel;

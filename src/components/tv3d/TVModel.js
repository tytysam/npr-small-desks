import React, { useMemo, useRef, useCallback, useState } from 'react';
import { RoundedBox } from '@react-three/drei';
import Knob3D from './Knob3D';
import ScreenSurface, { SCREEN_W, SCREEN_H } from './ScreenSurface';
import {
  makeWoodTexture,
  makeGrilleTexture,
  makeGlareTexture,
  makeLabelTexture,
  makeChannelRingTexture,
  makeVolumeTicksTexture,
  makeBezelGeometry,
} from './materials';

// Layout (world units). The cabinet is centred on the origin; +Z faces the viewer.
const CABINET = { w: 6.8, h: 5.2, d: 3.2 };
const FRONT_Z = CABINET.d / 2;
const FACEPLATE = { w: 6.2, h: 4.0, d: 0.08, y: 0.35 };
const FACE_Z = FRONT_Z + FACEPLATE.d; // front surface of the faceplate
const SCREEN = { x: -0.75, y: 0.35 };
const BEZEL = { outerW: SCREEN_W + 0.6, outerH: SCREEN_H + 0.6, depth: 0.14 };
const PANEL_X = 2.33;
const GRILLE = { w: 4.4, h: 0.62, y: -2.08 };
const LEG = { length: 1.25, spreadX: 2.7, spreadZ: 1.15, tilt: 0.14 };

const VOLUME_SWEEP = 270;
const CHANNEL_DETENT = 30;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

const Plate = ({ texture, position, size, rotation }) => (
  <mesh position={position} rotation={rotation}>
    <planeGeometry args={size} />
    <meshBasicMaterial map={texture} transparent depthWrite={false} />
  </mesh>
);

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
  isPlaying,
  resumeAt,
  onProgress,
  onPlay,
  onPause,
  onKnobDragging,
}) => {
  const woodTexture = useMemo(makeWoodTexture, []);
  const grilleTexture = useMemo(makeGrilleTexture, []);
  const glareTexture = useMemo(makeGlareTexture, []);
  const channelRingTexture = useMemo(makeChannelRingTexture, []);
  const volumeTicksTexture = useMemo(makeVolumeTicksTexture, []);
  const brandTexture = useMemo(
    () =>
      makeLabelTexture('NPR', {
        width: 384,
        height: 128,
        font: 'bold 72px Georgia, serif',
        color: '#161616',
        background: ['#d3cfc3', '#a6a297'],
        letterSpacing: 14,
      }),
    []
  );
  const nameplateTexture = useMemo(
    () =>
      makeLabelTexture((artistName || 'Tiny Desk').toUpperCase(), {
        width: 1024,
        height: 160,
        font: 'bold 64px Georgia, serif',
        color: '#2a1c05',
        background: ['#e6cb7a', '#c9a24a', '#7c5d22'],
        letterSpacing: 4,
      }),
    [artistName]
  );
  const bezelGeometry = useMemo(
    () => makeBezelGeometry({ ...BEZEL, innerW: SCREEN_W, innerH: SCREEN_H }),
    []
  );

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

  // --- channel knob ------------------------------------------------------
  const [detent, setDetent] = useState(0);
  const accumulatedRef = useRef(0);
  const handleChannelDelta = useCallback(
    (delta) => {
      accumulatedRef.current += delta;
      while (Math.abs(accumulatedRef.current) >= CHANNEL_DETENT) {
        const direction = accumulatedRef.current > 0 ? 1 : -1;
        accumulatedRef.current -= direction * CHANNEL_DETENT;
        onChannelChange(direction);
        setDetent((prev) => prev + direction);
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
        position: [sx * LEG.spreadX, -CABINET.h / 2 - LEG.length / 2 + 0.05, sz * LEG.spreadZ],
        rotation: [sz * LEG.tilt, 0, -sx * LEG.tilt],
      })),
    []
  );

  return (
    <group>
      {/* cabinet */}
      <RoundedBox args={[CABINET.w, CABINET.h, CABINET.d]} radius={0.09} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial map={woodTexture} roughness={0.5} metalness={0.05} />
      </RoundedBox>

      {/* brushed-metal faceplate */}
      <mesh position={[0, FACEPLATE.y, FRONT_Z + FACEPLATE.d / 2]} castShadow>
        <boxGeometry args={[FACEPLATE.w, FACEPLATE.h, FACEPLATE.d]} />
        <meshStandardMaterial color="#c2beb2" roughness={0.38} metalness={0.85} />
      </mesh>

      {/* bezel with cutout */}
      <mesh geometry={bezelGeometry} position={[SCREEN.x, SCREEN.y, FACE_Z]} castShadow>
        <meshStandardMaterial color="#161616" roughness={0.65} metalness={0.1} />
      </mesh>

      {/* the tube (DOM layer punched through the canvas) */}
      <ScreenSurface
        position={[SCREEN.x, SCREEN.y, FACE_Z + 0.02]}
        video={video}
        volume={volume}
        isLoading={isLoading}
        error={error}
        resumeAt={resumeAt}
        onProgress={onProgress}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={() => onChannelChange(1)}
      />

      {/* glass glare over the tube */}
      <mesh position={[SCREEN.x, SCREEN.y, FACE_Z + 0.035]}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshBasicMaterial map={glareTexture} transparent opacity={0.28} depthWrite={false} />
      </mesh>

      {/* control column */}
      <group position={[PANEL_X, 0, FACE_Z]}>
        <Plate texture={brandTexture} position={[0, 1.95, 0.012]} size={[1.05, 0.35]} />
        <mesh position={[0, 1.55, 0.03]}>
          <sphereGeometry args={[0.06, 24, 24]} />
          <meshStandardMaterial
            color={isPlaying ? '#ff5a4d' : '#4a1512'}
            emissive="#ff3b2f"
            emissiveIntensity={isPlaying ? 2.2 : 0.08}
            roughness={0.3}
          />
        </mesh>
        <pointLight position={[0, 1.55, 0.25]} color="#ff4a3a" intensity={isPlaying ? 0.6 : 0} distance={1.2} />

        <Knob3D
          position={[0, 0.6, 0]}
          radius={0.46}
          height={0.22}
          angleDeg={detent * CHANNEL_DETENT}
          onDelta={handleChannelDelta}
          onDragStart={startDrag}
          onDragEnd={endDrag}
          label={<Plate texture={channelRingTexture} position={[0, 0, 0.008]} size={[1.42, 1.42]} />}
        />

        <Knob3D
          position={[0, -0.72, 0]}
          radius={0.3}
          height={0.18}
          angleDeg={volume * VOLUME_SWEEP - VOLUME_SWEEP / 2}
          onDelta={handleVolumeDelta}
          onDragStart={startDrag}
          onDragEnd={endDrag}
          ridgeCount={18}
          label={<Plate texture={volumeTicksTexture} position={[0, 0, 0.008]} size={[0.95, 0.95]} />}
        />

        {/* decorative push buttons */}
        {[-0.28, 0.28].map((x) => (
          <mesh key={x} position={[x, -1.4, 0.06]} castShadow>
            <boxGeometry args={[0.28, 0.16, 0.12]} />
            <meshStandardMaterial color="#262626" roughness={0.6} />
          </mesh>
        ))}
      </group>

      {/* speaker cloth */}
      <mesh position={[SCREEN.x, GRILLE.y, FRONT_Z + 0.03]}>
        <boxGeometry args={[GRILLE.w, GRILLE.h, 0.06]} />
        <meshStandardMaterial map={grilleTexture} roughness={0.95} metalness={0} />
      </mesh>

      {/* brass nameplate */}
      <mesh position={[PANEL_X, GRILLE.y, FRONT_Z + 0.03]}>
        <boxGeometry args={[1.7, 0.36, 0.05]} />
        <meshStandardMaterial map={nameplateTexture} roughness={0.35} metalness={0.6} />
      </mesh>

      {/* legs */}
      {legs.map((leg, i) => (
        <group key={i} position={leg.position} rotation={leg.rotation}>
          <mesh castShadow>
            <cylinderGeometry args={[0.055, 0.095, LEG.length, 16]} />
            <meshStandardMaterial map={woodTexture} roughness={0.5} />
          </mesh>
          <mesh position={[0, -LEG.length / 2 + 0.06, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.12, 16]} />
            <meshStandardMaterial color="#c9a24a" roughness={0.3} metalness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

export default TVModel;

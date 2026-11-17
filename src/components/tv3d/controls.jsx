import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import useDisposable from './useDisposable';
import useFade from './useFade';
import useAntennaGesture from '../../hooks/useAntennaGesture';
import { PALETTE, PLASTIC, makeGuideTextures, makeGlyphTexture } from './materials';
import { GUIDE_SIZE } from './layout';
import { LAMP } from './lamps';

/*
 * The 3D set's controls and fittings that every cabinet shares: push-buttons,
 * the guide stack, the antenna, and the materials they're made of. The
 * cabinet (TVModel.jsx) places them.
 */

export const Plate = ({ texture, position, size, rotation }) => (
  <mesh position={position} rotation={rotation}>
    <planeGeometry args={size} />
    <meshBasicMaterial map={texture} transparent depthWrite={false} />
  </mesh>
);

export const Chrome = ({ color = PALETTE.chrome, ...props }) => <meshStandardMaterial color={color} metalness={1} roughness={0.2} {...props} />;

// Brushed silver for faces that look straight at the viewer: a pure mirror
// there reflects the empty space behind the camera and reads as dark grey, so
// mix in diffuse shading (as the knobs do) to match the 2D set's silver.
export const Silver = ({ color = '#d6d6d2', ...props }) => <meshStandardMaterial color={color} metalness={0.55} roughness={0.3} {...props} />;

// The silver and chrome a shade darker (about 10%), for a set whose metal
// should sit back against brass (the teak set's `rail.metal: 'dark'`).
export const DARK_SILVER = '#c1c1bd';
export const DARK_CHROME = '#cfcfcf';

const MENU_RADIUS = 0.085;
const MENU_HEIGHT = 0.08;
const MENU_TRAVEL = MENU_HEIGHT / 3; // sinks a third of its height
// The heart button is smaller than MENU, with a red rim round its heart.
const HEART_RADIUS = MENU_RADIUS * 0.8;
const HEART_INLAY = 1.15; // the heart's width, in button radii
const HEART_SQUASH = 0.8; // as .heart-glyph squashes the guide's ♥

/**
 * A push-button on the rail: MENU (silver, latched in while SETUP is open)
 * and the heart (red, latched in while the concert is hearted); on the
 * cream set, MENU and power are plain grey plastic caps, domed like its dish
 * knobs' (`finish="grey"`); on the teak set MENU is a shade darker
 * (`finish="darkSilver"`). It sinks
 * into the cabinet while `pressed` and springs back out; frames only render
 * while it's moving. A `disabled` button ignores clicks.
 */
export const PushButton = ({ position, pressed, onPress, disabled = false, finish = 'silver' }) => {
  const groupRef = useRef(null);
  const radius = finish === 'heart' ? HEART_RADIUS : MENU_RADIUS;
  // The same ♥ as the TV guide's: its glyph, drawn in its font.
  const heart = useDisposable(() => (finish === 'heart' ? makeGlyphTexture('♥', { color: '#ffe6da' }) : null), [finish]);
  const motion = useRef({ z: 0, v: 0 });
  const [hovered, setHovered] = useState(false);
  const invalidate = useThree((state) => state.invalidate);

  // The heart's enamel dims while the set is off (disabled), and glows while
  // latched (and the set is on); both fade.
  const capRef = useRef(null);
  useFade(disabled ? 0 : 1, (k) => {
    if (finish === 'heart' && capRef.current) capRef.current.color.lerpColors(LAMP.heart.off, LAMP.heart.on, k);
  });
  useFade((pressed && !disabled ? LAMP.heart.glow : 0) + (hovered && !disabled ? LAMP.heart.hover : 0), (glow) => {
    if (finish === 'heart' && capRef.current) capRef.current.emissiveIntensity = glow;
  });

  useEffect(() => invalidate(), [pressed, invalidate]);

  useFrame((_, delta) => {
    const m = motion.current;
    const target = pressed ? -MENU_TRAVEL : 0;
    // Slightly underdamped spring: ~150 ms, with a small overshoot.
    const dt = Math.min(delta, 1 / 30);
    m.v += (900 * (target - m.z) - 40 * m.v) * dt;
    m.z += m.v * dt;
    if (Math.abs(target - m.z) < 1e-4 && Math.abs(m.v) < 1e-3) {
      m.z = target;
      m.v = 0;
    } else {
      invalidate();
    }
    if (groupRef.current) groupRef.current.position.z = m.z;
  });

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onPress();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (disabled) return;
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = '';
      }}
    >
      <group ref={groupRef}>
        {finish === 'grey' ? (
          // grey plastic: a straight stem, domed on top
          <>
            <mesh position={[0, 0, MENU_HEIGHT / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[MENU_RADIUS, MENU_RADIUS, MENU_HEIGHT, 48]} />
              <meshPhysicalMaterial color={PLASTIC.grey} {...PLASTIC.finish} emissive="#ffffff" emissiveIntensity={hovered ? 0.08 : 0} />
            </mesh>
            <mesh position={[0, 0, MENU_HEIGHT]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.4, 1]} castShadow>
              <sphereGeometry args={[MENU_RADIUS, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshPhysicalMaterial color={PLASTIC.grey} {...PLASTIC.finish} emissive="#ffffff" emissiveIntensity={hovered ? 0.08 : 0} />
            </mesh>
          </>
        ) : (
          <mesh position={[0, 0, MENU_HEIGHT / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[radius, radius * 1.08, MENU_HEIGHT, 32]} />
            {finish === 'heart' ? (
              // red enamel, glowing faintly while latched; colour and glow set by useFade
              <meshStandardMaterial ref={capRef} roughness={0.35} metalness={0.1} emissive="#ff5a46" />
            ) : (
              // silver, or a shade darker (`darkSilver`, the teak set's)
              <Silver color={finish === 'darkSilver' ? DARK_SILVER : undefined} emissive="#ffffff" emissiveIntensity={hovered ? 0.08 : 0} />
            )}
          </mesh>
        )}
        {/* the face: the heart's ♥, or a dark centre on metal */}
        {finish === 'heart' && (
          <mesh position={[0, 0, MENU_HEIGHT + 0.001]}>
            <planeGeometry args={[HEART_RADIUS * HEART_INLAY, ((HEART_RADIUS * HEART_INLAY) / heart.aspect) * HEART_SQUASH]} />
            <meshStandardMaterial map={heart.texture} transparent alphaTest={0.05} roughness={0.5} />
          </mesh>
        )}
        {(finish === 'silver' || finish === 'darkSilver') && (
          <mesh position={[0, 0, MENU_HEIGHT + 0.001]}>
            <circleGeometry args={[MENU_RADIUS * 0.25, 20]} />
            <meshStandardMaterial color="#2a2a2a" roughness={0.6} />
          </mesh>
        )}
      </group>
    </group>
  );
};

// The TV guide lies on two older issues near the front of the top board.
const GUIDE_ISSUES = [
  { color: '#c4372b', ink: '#fff8ec', text: 'NP-R1 LISTINGS · TINY DESK WEEKLY', thickness: 0.09, yaw: -0.07, dx: 0 },
  { color: '#2f5d7c', ink: '#e8dfc8', text: 'NP-R1 LISTINGS · NO. 38', thickness: 0.075, yaw: 0.05, dx: 0.06 },
  { color: '#d9a43a', ink: '#3a2a12', text: 'NP-R1 LISTINGS · NO. 37', thickness: 0.075, yaw: -0.02, dx: -0.04 },
];

// Stacked bottom-up: the last issue lies on the board, the guide on top.
const GUIDE_LAYERS = (() => {
  let y = 0;
  return GUIDE_ISSUES.map((issue, i) => ({ ...issue, i }))
    .reverse()
    .map((issue) => {
      const centre = y + issue.thickness / 2;
      y += issue.thickness;
      return { ...issue, centre };
    });
})();

/**
 * The stack of guides on top of the set. Clicking any of them opens the
 * guide; the top one lifts a little on hover and while it's open.
 */
export const GuideStack = ({ position, open, onOpen }) => {
  const textures = useDisposable(() => makeGuideTextures(GUIDE_ISSUES), []);
  const pages = useDisposable(() => new THREE.MeshStandardMaterial({ color: '#e8dfc6', roughness: 0.95 }), []);
  const covers = useDisposable(
    () =>
      GUIDE_ISSUES.map(
        ({ color }, i) =>
          new THREE.MeshStandardMaterial(i === 0 ? { map: textures.cover, roughness: 0.6 } : { color, roughness: 0.7 })
      ),
    [textures]
  );
  const spines = useDisposable(
    () => textures.spines.map((map) => new THREE.MeshStandardMaterial({ map, roughness: 0.6 })),
    [textures]
  );
  const topRef = useRef(null);
  const motion = useRef({ y: 0, v: 0 });
  const [hovered, setHovered] = useState(false);
  const invalidate = useThree((state) => state.invalidate);
  const lifted = hovered || open;

  useEffect(() => invalidate(), [lifted, invalidate]);

  useFrame((_, delta) => {
    const m = motion.current;
    const target = lifted ? GUIDE_SIZE.lift : 0;
    const dt = Math.min(delta, 1 / 30);
    m.v += (600 * (target - m.y) - 38 * m.v) * dt;
    m.y += m.v * dt;
    if (Math.abs(target - m.y) < 1e-4 && Math.abs(m.v) < 1e-3) {
      m.y = target;
      m.v = 0;
    } else {
      invalidate();
    }
    if (topRef.current) topRef.current.position.y = topRef.current.userData.restY + m.y;
  });

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        // The book grows out of the stack: about its on-screen width at the default framing.
        onOpen({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, width: 160 });
      }}
      onPointerDown={(e) => {
        // Keep the camera from starting an orbit on a click here.
        e.nativeEvent?.stopImmediatePropagation?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = '';
      }}
    >
      {GUIDE_LAYERS.map(({ i, thickness, yaw, dx, centre }) => (
        <mesh
          key={i}
          ref={i === 0 ? topRef : undefined}
          userData={{ restY: centre }}
          position={[dx, centre, 0]}
          rotation={[0, yaw, 0]}
          // box faces: +x, −x, +y (cover), −y, +z (spine), −z
          material={[pages, pages, covers[i], pages, spines[i], pages]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[GUIDE_SIZE.length, thickness, GUIDE_SIZE.width]} />
        </mesh>
      ))}
    </group>
  );
};

const DEG = Math.PI / 180;
const ANTENNA_SECTIONS = [
  { r: 0.03, len: 0.62 },
  { r: 0.023, len: 0.58 },
  { r: 0.016, len: 0.52 },
];
const ANTENNA_LENGTH = ANTENNA_SECTIONS.reduce((sum, { len }) => sum + len - 0.04, 0.05);
// Each section's centre height: they telescope, overlapping by 0.04.
const ANTENNA_LAYOUT = (() => {
  let y = 0.05;
  return ANTENNA_SECTIONS.map((section) => {
    const cy = y + section.len / 2;
    y += section.len - 0.04;
    return { ...section, cy };
  });
})();

/**
 * Three-section telescoping rod on a ball mount, leaning back slightly.
 * Swing it to hunt for a new station, tap to retune, press and hold to SCAN
 * (see useAntennaGesture). `wobble` is bumped by the app to replay a
 * springy flick; frames only render while it's moving.
 */
export const Antenna = ({ position, angle, wobble, onBusy, onDragStart, onAim, onRelease, onTap, onHoldStart, onHoldEnd }) => {
  const mountRef = useRef(null);
  const swingRef = useRef(null);
  const wobbleStartRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const invalidate = useThree((state) => state.invalidate);
  const scratch = useMemo(
    () => ({ plane: new THREE.Plane(), point: new THREE.Vector3(), origin: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1) }),
    []
  );

  // Pointer ray against the plane facing the viewer through the mount:
  // 0° = straight up, clockwise positive, like the 2D set.
  const angleFromEvent = useCallback(
    (e) => {
      if (!mountRef.current || !e.ray) return null;
      mountRef.current.getWorldPosition(scratch.origin);
      scratch.plane.setFromNormalAndCoplanarPoint(scratch.normal, scratch.origin);
      if (!e.ray.intersectPlane(scratch.plane, scratch.point)) return null;
      return Math.atan2(scratch.point.x - scratch.origin.x, scratch.point.y - scratch.origin.y) / DEG;
    },
    [scratch]
  );

  const gesture = useAntennaGesture({ angleFromEvent, onDragStart, onAim, onRelease, onTap, onHoldStart, onHoldEnd });
  // Hold the camera still from the moment the antenna is grabbed, as the knobs do.
  const handlers = {
    ...gesture,
    onPointerDown: (e) => {
      // R3F's listener runs before OrbitControls' on the same element, so this
      // keeps the camera from ever starting a rotate on an antenna grab.
      e.nativeEvent?.stopImmediatePropagation?.();
      onBusy(true);
      gesture.onPointerDown(e);
    },
    onPointerUp: (e) => {
      gesture.onPointerUp(e);
      onBusy(false);
    },
    onPointerCancel: (e) => {
      gesture.onPointerCancel(e);
      onBusy(false);
    },
  };

  useEffect(() => {
    if (!wobble) return;
    wobbleStartRef.current = performance.now();
    invalidate();
  }, [wobble, invalidate]);

  useFrame(() => {
    let flick = 0;
    if (wobbleStartRef.current !== null) {
      const t = (performance.now() - wobbleStartRef.current) / 1000;
      if (t < 1.2) {
        flick = 14 * Math.exp(-4 * t) * Math.sin(14 * t);
        invalidate();
      } else {
        wobbleStartRef.current = null;
      }
    }
    if (swingRef.current) swingRef.current.rotation.z = -(angle + flick) * DEG;
  });

  return (
    <group
      ref={mountRef}
      position={position}
      rotation={[-0.18, 0, -0.04]}
      {...handlers}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'grab';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = '';
      }}
    >
      <mesh castShadow>
        <sphereGeometry args={[0.11, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Chrome emissive="#ffffff" emissiveIntensity={hovered ? 0.08 : 0} />
      </mesh>
      <group ref={swingRef} rotation={[0, 0, -angle * DEG]}>
        {ANTENNA_LAYOUT.map(({ r, len, cy }, i) => (
          <group key={i}>
            <mesh position={[0, cy, 0]} castShadow>
              <cylinderGeometry args={[r, r, len, 16]} />
              <Chrome roughness={0.15} emissive="#ffffff" emissiveIntensity={hovered ? 0.08 : 0} />
            </mesh>
            <mesh position={[0, cy + len / 2 - 0.02, 0]}>
              <cylinderGeometry args={[r * 1.35, r * 1.35, 0.04, 16]} />
              <Chrome roughness={0.3} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, ANTENNA_LENGTH + 0.04, 0]}>
          <sphereGeometry args={[0.028, 16, 12]} />
          <Chrome />
        </mesh>
        {/* the rod is only a few pixels wide on screen, so grab a wider sleeve around it */}
        <mesh position={[0, ANTENNA_LENGTH / 2, 0]}>
          <cylinderGeometry args={[0.14, 0.14, ANTENNA_LENGTH, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
};

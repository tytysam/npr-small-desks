import { useRef, useMemo, useCallback, useState } from 'react';
import * as THREE from 'three';
import { normalizeDelta } from '../../hooks/useKnobDrag';
import { makeKnurlTexture, PALETTE } from './materials';
import useDisposable from './useDisposable';

const RAD_TO_DEG = 180 / Math.PI;

const FINISHES = {
  chrome: { rim: PALETTE.chrome, face: '#d6d6d6', bar: '#1a1a1a', metalness: 0.75 },
  black: { rim: '#1e1e1e', face: '#262626', bar: '#6a665c', metalness: 0.25 },
  grey: { rim: '#8e8e8a', face: '#bdbdb8', bar: '#4a4a47', metalness: 0.1 },
};
const DEG_TO_RAD = Math.PI / 180;

/**
 * A bar handle (the teak set's dials): no knob under it, just a smooth bar
 * across the dial in `material` (the set's brass), tapering gently toward
 * its indicator end (+Y) to a blunt, rounded tip, its edges eased, and
 * pinched in at both sides toward the other end, where you'd grip it.
 */
const BarHandle = ({ radius, material }) => {
  const length = radius * 1.9;
  const width = radius * 0.46; // as wide as the 2D set's, for its proportions
  const height = radius * 0.24;
  const bevel = height * 0.25;
  const geometry = useDisposable(() => {
    // the outline, inset by the bevel (three.js bevels grow it outward)
    const w = width / 2 - bevel;
    const tip = w * 0.55; // half-width at the indicator end
    const top = length / 2 - bevel;
    const bottom = -top;
    const taperFrom = top - length * 0.4; // where the taper starts
    const r = w * 0.5; // the ends' rounding
    // the pinch: both sides curving in by `pinch`, 12–40% up from the wide end
    const pinch = w * 0.15;
    const pinchLow = -length / 2 + length * 0.12;
    const pinchHigh = -length / 2 + length * 0.4;
    const pinchMid = (pinchLow + pinchHigh) / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-w, bottom + r);
    shape.lineTo(-w, pinchLow);
    shape.quadraticCurveTo(-w + 2 * pinch, pinchMid, -w, pinchHigh);
    shape.lineTo(-w, taperFrom);
    shape.lineTo(-tip, top - r * 0.6);
    shape.quadraticCurveTo(-tip, top, 0, top);
    shape.quadraticCurveTo(tip, top, tip, top - r * 0.6);
    shape.lineTo(w, taperFrom);
    shape.lineTo(w, pinchHigh);
    shape.quadraticCurveTo(w - 2 * pinch, pinchMid, w, pinchLow);
    shape.lineTo(w, bottom + r);
    shape.quadraticCurveTo(w, bottom, w - r, bottom);
    shape.lineTo(-w + r, bottom);
    shape.quadraticCurveTo(-w, bottom, -w, bottom + r);
    return new THREE.ExtrudeGeometry(shape, {
      depth: height - 2 * bevel,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 4,
      curveSegments: 12,
    });
  }, [width, length, height, bevel]);
  return <mesh geometry={geometry} material={material} position={[0, 0, bevel + 0.005]} castShadow />;
};

/**
 * A knurled chrome rotary knob with a dark grip bar, standing proud of the faceplate, facing +Z.
 *
 * Dragging anywhere on it reports clockwise-positive angular deltas (degrees)
 * through `onDelta`, using the pointer ray intersected with the knob's face
 * plane so the gesture feels like turning a real dial from any camera angle.
 * `angleDeg` is the knob's displayed rotation (clockwise-positive, like CSS).
 * `style` 'bar' draws only a bar handle in `material` (BarHandle), over a
 * hidden disc the knob's size, so the whole dial still turns it.
 */
const Knob3D = ({
  position,
  radius = 0.4,
  height = 0.2,
  angleDeg = 0,
  onDelta,
  onDragStart,
  onDragEnd,
  ridgeCount = 60,
  finish = 'chrome',
  label,
  style = 'knob',
  material,
}) => {
  const rootRef = useRef(null);
  const lastAngleRef = useRef(0);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  const scratch = useMemo(
    () => ({ plane: new THREE.Plane(), point: new THREE.Vector3(), origin: new THREE.Vector3(), normal: new THREE.Vector3() }),
    []
  );

  // Angle (degrees, screen-clockwise-positive) of the pointer ray around the knob axis.
  const angleFromRay = useCallback(
    (ray) => {
      const root = rootRef.current;
      if (!root) return null;
      root.getWorldPosition(scratch.origin);
      scratch.normal.set(0, 0, 1).transformDirection(root.matrixWorld).normalize();
      scratch.plane.setFromNormalAndCoplanarPoint(scratch.normal, scratch.origin);
      if (!ray.intersectPlane(scratch.plane, scratch.point)) return null;
      root.worldToLocal(scratch.point);
      // World y is up, so flip to get clockwise-positive like the 2D knobs.
      return -Math.atan2(scratch.point.y, scratch.point.x) * RAD_TO_DEG;
    },
    [scratch]
  );

  const handlePointerDown = useCallback(
    (e) => {
      e.stopPropagation();
      const angle = angleFromRay(e.ray);
      if (angle === null) return;
      lastAngleRef.current = angle;
      e.target.setPointerCapture(e.pointerId);
      setDragging(true);
      onDragStart?.();
    },
    [angleFromRay, onDragStart]
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!dragging) return;
      e.stopPropagation();
      const angle = angleFromRay(e.ray);
      if (angle === null) return;
      const delta = normalizeDelta(angle - lastAngleRef.current);
      lastAngleRef.current = angle;
      if (delta !== 0) onDelta(delta);
    },
    [dragging, angleFromRay, onDelta]
  );

  const handlePointerUp = useCallback(
    (e) => {
      if (!dragging) return;
      e.stopPropagation();
      e.target.releasePointerCapture?.(e.pointerId);
      setDragging(false);
      if (!hovered) document.body.style.cursor = '';
      onDragEnd?.();
    },
    [dragging, hovered, onDragEnd]
  );

  const handleOver = useCallback((e) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'grab';
  }, []);

  const handleOut = useCallback(() => {
    setHovered(false);
    if (!dragging) document.body.style.cursor = '';
  }, [dragging]);

  const knurl = useDisposable(() => (style === 'bar' ? null : makeKnurlTexture(ridgeCount)), [style, ridgeCount]);
  const lit = hovered || dragging;
  const look = FINISHES[finish] ?? FINISHES.chrome;

  return (
    <group
      ref={rootRef}
      position={position}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onLostPointerCapture={handlePointerUp}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    >
      {label}
      {style === 'bar' && (
        <>
          {/* what the pointer grabs: the dial, round the bar */}
          <mesh position={[0, 0, 0.01]}>
            <circleGeometry args={[radius, 32]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <group rotation={[0, 0, -angleDeg * DEG_TO_RAD]}>
            <BarHandle radius={radius} material={material} />
          </group>
        </>
      )}
      {style !== 'bar' && (
        <group rotation={[0, 0, -angleDeg * DEG_TO_RAD]}>
          {/* knurled chrome rim */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, height / 2]} castShadow>
            <cylinderGeometry args={[radius, radius, height, 96, 1, true]} />
            <meshStandardMaterial
              color={look.rim}
              metalness={look.metalness}
              roughness={0.35}
              roughnessMap={knurl}
              bumpMap={knurl}
              bumpScale={3}
              emissive="#ffffff"
              emissiveIntensity={lit ? 0.06 : 0}
            />
          </mesh>
          {/* rounded shoulder where the rim meets the face */}
          <mesh position={[0, 0, height]}>
            <torusGeometry args={[radius * 0.955, radius * 0.05, 12, 64]} />
            <meshStandardMaterial color={look.rim} metalness={look.metalness} roughness={0.25} />
          </mesh>
          {/* spun-metal face: part diffuse, since it faces the viewer and a pure mirror would read black */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, height]}>
            <cylinderGeometry args={[radius * 0.93, radius * 0.93, 0.02, 64]} />
            <meshStandardMaterial
              color={look.face}
              metalness={look.metalness * 0.7}
              roughness={0.3}
              emissive="#ffffff"
              emissiveIntensity={lit ? 0.06 : 0}
            />
          </mesh>
          {/* dark grip bar across the face */}
          <mesh position={[0, 0, height + 0.035]} castShadow>
            <boxGeometry args={[radius * 0.36, radius * 1.72, 0.06]} />
            <meshStandardMaterial color={look.bar} roughness={0.45} metalness={0.2} />
          </mesh>
          {/* cream tip marks the pointing end */}
          <mesh position={[0, radius * 0.76, height + 0.066]}>
            <boxGeometry args={[radius * 0.3, radius * 0.14, 0.004]} />
            <meshStandardMaterial color={PALETTE.cream} roughness={0.5} />
          </mesh>
          {/* chrome hub */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, height + 0.075]}>
            <cylinderGeometry args={[radius * 0.15, radius * 0.17, 0.03, 32]} />
            <meshStandardMaterial color={PALETTE.chrome} metalness={0.7} roughness={0.2} />
          </mesh>
        </group>
      )}
    </group>
  );
};

export default Knob3D;

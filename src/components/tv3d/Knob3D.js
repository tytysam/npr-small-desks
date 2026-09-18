import React, { useRef, useMemo, useCallback, useState } from 'react';
import * as THREE from 'three';
import { normalizeDelta } from '../../hooks/useKnobDrag';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

/**
 * A ribbed rotary knob standing proud of the faceplate, facing +Z.
 *
 * Dragging anywhere on it reports clockwise-positive angular deltas (degrees)
 * through `onDelta`, using the pointer ray intersected with the knob's face
 * plane so the gesture feels like turning a real dial from any camera angle.
 * `angleDeg` is the knob's displayed rotation (clockwise-positive, like CSS).
 */
const Knob3D = ({
  position,
  radius = 0.4,
  height = 0.2,
  angleDeg = 0,
  onDelta,
  onDragStart,
  onDragEnd,
  ridgeCount = 24,
  label,
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

  const ridges = useMemo(
    () =>
      Array.from({ length: ridgeCount }, (_, i) => {
        const a = (i / ridgeCount) * Math.PI * 2;
        return { position: [Math.cos(a) * radius, Math.sin(a) * radius, height / 2], rotation: [0, 0, a] };
      }),
    [ridgeCount, radius, height]
  );

  const bodyColor = hovered || dragging ? '#3a3a3a' : '#2b2b2b';

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
      <group rotation={[0, 0, -angleDeg * DEG_TO_RAD]}>
        {/* body */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, height / 2]} castShadow>
          <cylinderGeometry args={[radius * 0.98, radius, height, 48]} />
          <meshStandardMaterial color={bodyColor} roughness={0.75} metalness={0.05} />
        </mesh>
        {/* ridged grip */}
        {ridges.map((r, i) => (
          <mesh key={i} position={r.position} rotation={r.rotation}>
            <boxGeometry args={[0.05, radius * 0.11, height * 0.85]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
          </mesh>
        ))}
        {/* dished face */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, height + 0.005]}>
          <cylinderGeometry args={[radius * 0.82, radius * 0.82, 0.01, 48]} />
          <meshStandardMaterial color="#202020" roughness={0.5} metalness={0.15} />
        </mesh>
        {/* chrome cap */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, height + 0.03]}>
          <cylinderGeometry args={[radius * 0.32, radius * 0.3, 0.05, 48]} />
          <meshStandardMaterial color="#e8e8e8" roughness={0.18} metalness={1} />
        </mesh>
        {/* brass indicator */}
        <mesh position={[0, radius * 0.62, height + 0.012]}>
          <boxGeometry args={[0.045, radius * 0.36, 0.015]} />
          <meshStandardMaterial color="#e2c46a" roughness={0.35} metalness={0.7} emissive="#4d3a10" emissiveIntensity={0.3} />
        </mesh>
      </group>
    </group>
  );
};

export default Knob3D;

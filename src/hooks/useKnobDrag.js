import { useRef, useCallback, useState } from 'react';

// Normalise an angle delta into (-180, 180] so dragging across the
// atan2 seam at ±180° doesn't produce a 360° jump.
export const normalizeDelta = (delta) => ((delta + 540) % 360) - 180;

const angleFromPointer = (clientX, clientY, rect) => {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
};

/**
 * Rotary-drag behaviour shared by the 2D knobs.
 *
 * Reports angular deltas (degrees, clockwise-positive) via `onDelta` as the
 * pointer circles the knob's centre. Also handles the mouse wheel and arrow
 * keys so the knobs work without a pointer.
 */
const useKnobDrag = ({ onDelta, onStart, onEnd, keyStep = 15, wheelStep = 6 }) => {
  const ref = useRef(null);
  const lastAngleRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = useCallback(
    (e) => {
      if (!ref.current) return;
      e.preventDefault();
      ref.current.setPointerCapture?.(e.pointerId);
      const rect = ref.current.getBoundingClientRect();
      lastAngleRef.current = angleFromPointer(e.clientX, e.clientY, rect);
      setIsDragging(true);
      onStart?.();
    },
    [onStart]
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!isDragging || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const angle = angleFromPointer(e.clientX, e.clientY, rect);
      const delta = normalizeDelta(angle - lastAngleRef.current);
      lastAngleRef.current = angle;
      if (delta !== 0) onDelta(delta);
    },
    [isDragging, onDelta]
  );

  const endDrag = useCallback(
    (e) => {
      if (!isDragging) return;
      ref.current?.releasePointerCapture?.(e.pointerId);
      setIsDragging(false);
      onEnd?.();
    },
    [isDragging, onEnd]
  );

  const onWheel = useCallback(
    (e) => {
      e.preventDefault();
      onDelta(e.deltaY > 0 ? wheelStep : -wheelStep);
    },
    [onDelta, wheelStep]
  );

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        onDelta(keyStep);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        onDelta(-keyStep);
      }
    },
    [onDelta, keyStep]
  );

  return {
    ref,
    isDragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: endDrag,
      onWheel,
      onKeyDown,
    },
  };
};

export default useKnobDrag;

import { useRef, useCallback } from 'react';

const HOLD_MS = 600;
const SLOP_PX = 5;

/**
 * Pointer handling for the antenna, shared by the 2D (DOM) and 3D (R3F)
 * sets — both deliver pointer events with clientX/Y and pointer capture.
 *
 * - drag: `onDragStart()`, then `onAim(angle)` as it moves, `onRelease()`
 * - tap (no movement): `onTap()`
 * - press and hold still: `onHoldStart()` … `onHoldEnd()` on release
 *
 * `angleFromEvent(e)` maps the pointer to an antenna angle in degrees.
 */
const useAntennaGesture = ({ angleFromEvent, onDragStart, onAim, onRelease, onTap, onHoldStart, onHoldEnd }) => {
  const stateRef = useRef(null);

  const onPointerDown = useCallback(
    (e) => {
      e.stopPropagation();
      e.target?.setPointerCapture?.(e.pointerId);
      const state = { x: e.clientX, y: e.clientY, moved: false, holding: false, timer: null };
      state.timer = setTimeout(() => {
        state.holding = true;
        onHoldStart?.();
      }, HOLD_MS);
      stateRef.current = state;
    },
    [onHoldStart]
  );

  const onPointerMove = useCallback(
    (e) => {
      const state = stateRef.current;
      if (!state || state.holding) return;
      e.stopPropagation();
      if (!state.moved) {
        if (Math.hypot(e.clientX - state.x, e.clientY - state.y) < SLOP_PX) return;
        state.moved = true;
        clearTimeout(state.timer);
        onDragStart?.();
      }
      const angle = angleFromEvent(e);
      if (angle !== null) onAim?.(angle);
    },
    [angleFromEvent, onDragStart, onAim]
  );

  const onPointerUp = useCallback(
    (e) => {
      const state = stateRef.current;
      if (!state) return;
      e.stopPropagation?.();
      e.target?.releasePointerCapture?.(e.pointerId);
      clearTimeout(state.timer);
      stateRef.current = null;
      if (state.holding) onHoldEnd?.();
      else if (state.moved) onRelease?.();
      else onTap?.();
    },
    [onHoldEnd, onRelease, onTap]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };
};

export default useAntennaGesture;

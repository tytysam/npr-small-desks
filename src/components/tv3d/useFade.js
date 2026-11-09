import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import useLatest from '../../hooks/useLatest';

// CSS's `ease`, cubic-bezier(0.25, 0.1, 0.25, 1): the 2D set's lamps use it.
const bezier = (a, b) => (t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
const easeX = bezier(0.25, 0.25);
const easeY = bezier(0.1, 1);
export const ease = (x) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (easeX(mid) < x) lo = mid;
    else hi = mid;
  }
  return easeY((lo + hi) / 2);
};

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Fades a number to `target` over `ms` with CSS's `ease`, like the 2D set's
 * lamps (a 0.3 s transition), for materials and lights in the 3D scene.
 *
 * `apply(value)` writes the value onto three.js objects directly, on mount
 * and on every frame of a fade, so the scene doesn't re-render through
 * React; the props it sets must therefore not also be passed in JSX (React
 * would snap them to the end value). Frames are only requested while a fade
 * is running, since the Canvas renders on demand. A new target mid-fade
 * starts from wherever the value has got to. Reduced motion: it just jumps.
 */
const useFade = (target, apply, ms = 300) => {
  const fade = useRef({ from: target, to: target, value: target, start: 0 });
  const applyRef = useLatest(apply);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    applyRef.current(fade.current.value);
    // Once, with the starting value; fades take it from there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const f = fade.current;
    if (f.to === target) return;
    f.from = f.value;
    f.to = target;
    f.start = performance.now();
    if (reducedMotion()) {
      f.value = target;
      applyRef.current(target);
    }
    invalidate();
  }, [target, applyRef, invalidate]);

  useFrame(() => {
    const f = fade.current;
    if (f.value === f.to) return;
    const t = Math.min(1, (performance.now() - f.start) / ms);
    f.value = t >= 1 ? f.to : f.from + (f.to - f.from) * ease(t);
    applyRef.current(f.value);
    if (t < 1) invalidate();
  });
};

export default useFade;

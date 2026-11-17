import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { FOV } from './layout';

const { ACTION } = CameraControlsImpl;

const MAX_DISTANCE = 20;
const WATCH_BACKOFF = 1.3; // the Watch view, this much farther than a tight fit

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Where each view puts the camera, for a viewport of `aspect` and a cabinet's
 * layout (cabinets.js): [position, target]. The front view frames the cabinet
 * plus the antenna above it and the legs below (the cabinet's `framing`);
 * narrow viewports back off so the whole cabinet stays in frame.
 */
const pose = (view, aspect, { spec, VIEW_ANCHORS }) => {
  const { distance, cameraY: CAMERA_Y, targetY, comfortAspect } = spec.framing;
  const fit = Math.min(MAX_DISTANCE, aspect >= comfortAspect ? distance : distance * (comfortAspect / aspect));
  const centre = [0, targetY, 0];
  switch (view) {
    case 'angle': {
      const d = fit * 1.04;
      return [[d * Math.sin(rad(38)), CAMERA_Y + 1.9, d * Math.cos(rad(38))], centre];
    }
    case 'back':
      return [[0, CAMERA_Y + 0.6, -fit], centre];
    case 'top': {
      // Down onto the top board, the guide in the foreground, from in front
      // and a little to the left.
      const [gx, gy, gz] = VIEW_ANCHORS.guide;
      const target = [gx * 0.45, gy, gz * 0.4];
      const d = fit * 0.82;
      const polar = Math.PI * 0.23;
      const flat = d * Math.sin(polar);
      return [[target[0] - flat * Math.sin(rad(15)), gy + d * Math.cos(polar), target[2] + flat * Math.cos(rad(15))], target];
    }
    case 'watch': {
      // Straight on, the bezel filling most of the frame. Aimed a little
      // below it and toward the controls (the cabinet's `framing.watch`), so
      // the rail and the knobs are in frame too.
      const [, , sz] = VIEW_ANCHORS.screen;
      const [w, h] = VIEW_ANCHORS.screenSize;
      const half = Math.tan(rad(FOV / 2));
      const d = (Math.max((h / 2) * 1.08, (w / 2 / aspect) * 1.08) / half) * WATCH_BACKOFF;
      const [x, y] = spec.framing.watch;
      return [[x, y, sz + d], [x, y, sz]];
    }
    default:
      return [[0, CAMERA_Y, fit], centre];
  }
};

/**
 * The 3D set's camera: drag to orbit, wheel or pinch to zoom, no panning.
 * `request` ({ view, n }) moves it to one of the Scene pane's views, eased
 * unless motion is reduced. `enabled` is false while a knob is being turned.
 * `layout` is the cabinet's (cabinets.js); a new cabinet reframes the view.
 */
const SceneCamera = ({ request, enabled, layout }) => {
  const controls = useRef(null);
  const size = useThree((state) => state.size);
  const aspect = size.width / size.height;
  // The last view asked for, and whether it's been moved away from since.
  const view = useRef({ name: request.view, moved: false });

  const goTo = (name, smooth) => {
    const c = controls.current;
    if (!c) return;
    const [[px, py, pz], [tx, ty, tz]] = pose(name, aspect, layout);
    c.setLookAt(px, py, pz, tx, ty, tz, smooth);
  };

  // A requested view: go there.
  useEffect(() => {
    view.current = { name: request.view, moved: false };
    goTo(request.view, request.n > 0 && !reducedMotion());
    // goTo reads the latest aspect; a resize is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  // A resize refits the view, unless you've orbited away from it; so does a
  // new cabinet, smoothly.
  useEffect(() => {
    if (!view.current.moved) goTo(view.current.name, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);
  const lastLayout = useRef(layout);
  useEffect(() => {
    if (lastLayout.current === layout) return;
    lastLayout.current = layout;
    if (!view.current.moved) goTo(view.current.name, !reducedMotion());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      enabled={enabled}
      minDistance={4}
      maxDistance={MAX_DISTANCE}
      minPolarAngle={Math.PI * 0.2}
      maxPolarAngle={Math.PI * 0.58}
      smoothTime={0.45}
      draggingSmoothTime={0.08}
      dollyToCursor={false}
      mouseButtons={{ left: ACTION.ROTATE, middle: ACTION.DOLLY, right: ACTION.NONE, wheel: ACTION.DOLLY }}
      touches={{ one: ACTION.TOUCH_ROTATE, two: ACTION.TOUCH_DOLLY, three: ACTION.NONE }}
      onStart={() => {
        view.current.moved = true;
      }}
    />
  );
};

export default SceneCamera;

import { Suspense, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import TVModel from './TVModel';
import SceneCamera from './SceneCamera';
import SceneLights from './SceneLights';
import { MOOD_LIGHTS } from './moods';
import { FOV } from './layout';
import './TV3D.css';

const CLOSE_VIEWS = ['top', 'watch'];

/**
 * The three.js set. The camera orbits all the way round (the back panel
 * hides the DOM screen from behind) but only tilts so far; knob drags
 * temporarily disable orbiting. The Scene pane (`scene`) picks the lighting
 * mood; `view` ({ view, n }) moves the
 * camera to one of its views, and double-clicking anything but a control
 * asks for the front view again (`onView`).
 *
 * Frames render on demand: the scene is static unless something changes, and
 * R3F redraws on prop changes while the camera invalidates as it moves.
 *
 * Pointer events are sourced from the wrapper div because drei's blending
 * occlusion turns pointer events off on the canvas itself. The raycaster is
 * fed coordinates relative to that wrapper (R3F's defaults assume the event
 * target is the canvas, which it no longer is).
 */
const TV3D = ({ scene, view, onView, ...props }) => {
  const wrapperRef = useRef(null);
  const contactRef = useRef(null);
  const [knobBusy, setKnobBusy] = useState(false);

  // Chrome mis-composites drei's CSS-3D tube layer — it drifts tens of px off
  // the bezel — unless the canvas sits on whole pixels. TV3D.css rounds the
  // size; centring can still land it on a half pixel, so nudge it back.
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return undefined;
    const snap = () => {
      el.style.left = '0px';
      el.style.top = '0px';
      const { left, top } = el.getBoundingClientRect();
      el.style.left = `${Math.round(left) - left}px`;
      el.style.top = `${Math.round(top) - top}px`;
    };
    snap();
    window.addEventListener('resize', snap);
    return () => window.removeEventListener('resize', snap);
  }, []);

  const computePointer = useCallback((event, state) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    state.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    state.raycaster.setFromCamera(state.pointer, state.camera);
  }, []);

  return (
    // Close views fade out at the top and bottom of the canvas too (TV3D.css).
    <div ref={wrapperRef} className={`tv3d-wrapper ${CLOSE_VIEWS.includes(view.view) ? 'is-close' : ''}`}>
      <Canvas
        eventSource={wrapperRef}
        onCreated={(state) => state.setEvents({ compute: computePointer })}
        // R3F's click-miss callback also fires for double-clicks that miss every control.
        onPointerMissed={(e) => e.type === 'dblclick' && onView('front')}
        shadows="percentage" /* PCFShadowMap: three removed the soft variant R3F defaults to */
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
        frameloop="demand"
        camera={{ fov: FOV }}
      >
        <SceneCamera request={view} enabled={!knobBusy} />
        <SceneLights mood={scene.mood} contactRef={contactRef} />

        <Suspense fallback={null}>
          <TVModel {...props} glow={MOOD_LIGHTS[scene.mood].glow} onKnobDragging={setKnobBusy} />
          {/* opacity: the mood's, from the start (SceneLights eases it between moods) */}
          <ContactShadows ref={contactRef} position={[0, -3.28, 0]} opacity={MOOD_LIGHTS[scene.mood].contact} blur={2.6} scale={16} far={4} frames={1} />
        </Suspense>
      </Canvas>
      <p className="tv3d-hint">Drag to look around · double-click to reset · turn the knobs to tune</p>
    </div>
  );
};

export default TV3D;

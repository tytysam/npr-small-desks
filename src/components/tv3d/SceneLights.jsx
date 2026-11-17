import { memo, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { MOOD_LIGHTS, mixMoods } from './moods';
import { ease } from './useFade';

const MOOD_MS = 900; // a lamp being switched off, not a cut

/**
 * Locally-rendered environment (no HDR download) so chrome and brass have
 * something to reflect. Memoised so it renders once: drei re-applies its
 * scene settings (resetting environmentIntensity, which the moods set) and
 * re-renders the cube map whenever it re-renders with new children.
 */
const StudioEnvironment = memo(() => (
  <Environment resolution={256} frames={1}>
    <Lightformer intensity={1.6} position={[0, 6, 4]} scale={[12, 4, 1]} color="#fff3dd" />
    <Lightformer intensity={0.8} position={[-8, 2, 2]} rotation={[0, Math.PI / 2, 0]} scale={[6, 3, 1]} color="#dfe6ff" />
    <Lightformer intensity={0.5} position={[8, 1, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[6, 3, 1]} color="#ffe2c4" />
    {/* tall strip on the left: the window streak in the glass and a crisp edge on the chrome */}
    <Lightformer form="rect" intensity={2} position={[-5, 1.5, 6]} scale={[1.2, 6, 1]} color="#ffffff" />
  </Environment>
));

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * The room's lights for a lighting mood (moods.js), easing from one mood to
 * the next. Like useFade, values are written straight onto the lights so
 * React doesn't re-render the scene, and frames are only requested while a
 * change is under way.
 * `contactRef` is the ContactShadows under the set, whose darkness follows
 * the mood (it's rendered after the model, so it can capture it).
 */
const SceneLights = ({ mood, contactRef }) => {
  const ambient = useRef(null);
  const key = useRef(null);
  const fill = useRef(null);
  const rim = useRef(null);
  const invalidate = useThree((state) => state.invalidate);
  // Not `done` at first, so the first frame applies the starting mood.
  const blend = useRef({ from: MOOD_LIGHTS[mood], to: MOOD_LIGHTS[mood], now: MOOD_LIGHTS[mood], start: -Infinity, done: false });

  const apply = (scene, m) => {
    if (ambient.current) {
      ambient.current.intensity = m.ambient;
      ambient.current.color.set(m.ambientColor);
    }
    if (key.current) {
      key.current.intensity = m.key;
      key.current.color.set(m.keyColor);
      key.current.position.set(...m.keyPos);
    }
    if (fill.current) {
      fill.current.intensity = m.fill;
      fill.current.color.set(m.fillColor);
    }
    if (rim.current) {
      rim.current.intensity = m.rim;
      rim.current.color.set(m.rimColor);
    }
    scene.environmentIntensity = m.env;
    // ContactShadows draws its shadow on a plane with a plain material.
    contactRef.current?.traverse((o) => {
      if (o.isMesh) o.material.opacity = m.contact;
    });
  };

  useEffect(() => {
    const b = blend.current;
    if (b.to === MOOD_LIGHTS[mood]) return;
    b.from = b.now;
    b.to = MOOD_LIGHTS[mood];
    // Reduced motion: straight there, on the next frame.
    b.start = reducedMotion() ? -Infinity : performance.now();
    b.done = false;
    invalidate();
  }, [mood, invalidate]);

  useFrame((state) => {
    const b = blend.current;
    if (b.done) return;
    const t = Math.min(1, (performance.now() - b.start) / MOOD_MS);
    b.now = t >= 1 ? b.to : mixMoods(b.from, b.to, ease(t));
    b.done = t >= 1;
    apply(state.scene, b.now);
    if (!b.done) invalidate();
  });

  return (
    <>
      <ambientLight ref={ambient} />
      <directionalLight ref={key} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight ref={fill} position={[-6, 2, 4]} />
      <spotLight ref={rim} position={[0, 6, -5]} angle={0.6} penumbra={0.6} />
      <StudioEnvironment />
    </>
  );
};

export default SceneLights;

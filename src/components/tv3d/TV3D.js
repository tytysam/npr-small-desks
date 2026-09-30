import React, { Suspense, useRef, useState, useCallback, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment, Lightformer } from '@react-three/drei';
import TVModel from './TVModel';
import './TV3D.css';

// Frames the cabinet plus the antenna above it and the legs below.
const BASE_DISTANCE = 12.4;
const CAMERA_Y = 0.8;
const TARGET_Y = 0.35;
const COMFORT_ASPECT = 1.15;

// Backs the camera off on narrow viewports so the whole cabinet stays in frame.
const FitCamera = () => {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / size.height;
    const distance = aspect >= COMFORT_ASPECT ? BASE_DISTANCE : BASE_DISTANCE * (COMFORT_ASPECT / aspect);
    camera.position.set(0, CAMERA_Y, Math.min(distance, 20));
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
};

/**
 * The three.js set. Camera orbits within limits that keep the (flat, DOM)
 * screen facing the viewer; knob drags temporarily disable orbiting.
 *
 * Pointer events are sourced from the wrapper div because drei's blending
 * occlusion turns pointer events off on the canvas itself. The raycaster is
 * fed coordinates relative to that wrapper (R3F's defaults assume the event
 * target is the canvas, which it no longer is).
 */
const TV3D = (props) => {
  const wrapperRef = useRef(null);
  const [knobBusy, setKnobBusy] = useState(false);

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
    <div ref={wrapperRef} className="tv3d-wrapper">
      <Canvas
        eventSource={wrapperRef}
        onCreated={(state) => state.setEvents({ compute: computePointer })}
        shadows
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
        camera={{ position: [0, CAMERA_Y, BASE_DISTANCE], fov: 38 }}
      >
        <FitCamera />
        <ambientLight intensity={0.4} />
        <directionalLight position={[4, 7, 6]} intensity={2.4} color="#fff1dc" castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-6, 2, 4]} intensity={0.8} />
        <spotLight position={[0, 6, -5]} intensity={0.8} angle={0.6} penumbra={0.6} />

        <Suspense fallback={null}>
          {/* Locally-rendered environment (no HDR download) so chrome and brass have something to reflect. */}
          <Environment resolution={256} frames={1}>
            <Lightformer intensity={1.6} position={[0, 6, 4]} scale={[12, 4, 1]} color="#fff3dd" />
            <Lightformer intensity={0.8} position={[-8, 2, 2]} rotation={[0, Math.PI / 2, 0]} scale={[6, 3, 1]} color="#dfe6ff" />
            <Lightformer intensity={0.5} position={[8, 1, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[6, 3, 1]} color="#ffe2c4" />
            {/* tall strip on the left: the window streak in the glass and a crisp edge on the chrome */}
            <Lightformer form="rect" intensity={2} position={[-5, 1.5, 6]} scale={[1.2, 6, 1]} color="#ffffff" />
          </Environment>
          <TVModel {...props} onKnobDragging={setKnobBusy} />
          <ContactShadows position={[0, -3.28, 0]} opacity={0.65} blur={2.6} scale={16} far={4} />
        </Suspense>

        <OrbitControls
          makeDefault
          enabled={!knobBusy}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          target={[0, TARGET_Y, 0]}
          minDistance={6.5}
          maxDistance={20}
          minPolarAngle={Math.PI * 0.32}
          maxPolarAngle={Math.PI * 0.58}
          minAzimuthAngle={-Math.PI / 3}
          maxAzimuthAngle={Math.PI / 3}
        />
      </Canvas>
      <p className="tv3d-hint">Drag to look around · turn the knobs to tune</p>
    </div>
  );
};

export default TV3D;

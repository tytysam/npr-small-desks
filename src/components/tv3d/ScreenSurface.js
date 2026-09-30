import React from 'react';
import { Html } from '@react-three/drei';
import Screen from '../Screen';

// drei's transform mode maps CSS px to world units as px * distanceFactor / 400,
// so a 400x300 element with distanceFactor 4 is exactly SCREEN_W x SCREEN_H.
export const SCREEN_W = 4;
export const SCREEN_H = 3;
const CSS_W = 400;
const CSS_H = 300;

/**
 * The picture tube, placed in the scene as a DOM layer.
 *
 * A cross-origin YouTube iframe can't be sampled as a WebGL texture, so drei's
 * "blending" occlusion puts the element *behind* the canvas and punches a
 * depth-only hole in the scene where the screen is. pointer-events are off so
 * orbiting and knob drags over the picture still reach the canvas wrapper.
 */
const ScreenSurface = ({ position, ...screenProps }) => (
  <Html
    transform
    occlude="blending"
    distanceFactor={4}
    position={position}
    zIndexRange={[10, 0]}
    style={{ width: CSS_W, height: CSS_H, pointerEvents: 'none' }}
  >
    <div
      style={{
        width: CSS_W,
        height: CSS_H,
        background: '#000',
        borderRadius: '14% / 18%',
        overflow: 'hidden',
      }}
    >
      <Screen {...screenProps} />
    </div>
  </Html>
);

export default ScreenSurface;

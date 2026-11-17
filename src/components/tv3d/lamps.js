import * as THREE from 'three';
import { PALETTE } from './materials';

// The set's lights, off → on. They fade between the two like the 2D set's
// (a 0.3 s CSS transition), via useFade.
export const LAMP = {
  heart: { off: new THREE.Color('#6e2a22'), on: new THREE.Color(PALETTE.heart), glow: 0.35, hover: 0.1 },
  onAir: { off: new THREE.Color('#2a0d08'), on: new THREE.Color('#d8352a'), glow: 1.4, light: 0.25 },
  pilot: { off: new THREE.Color('#5a3a12'), on: new THREE.Color('#ffd08a'), glow: [0.05, 2.2], light: 0.5 },
};

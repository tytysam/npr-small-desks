import { useState, useCallback, useRef, useEffect } from 'react';

const SEEK_MS = 950; // "finding a station" after the antenna settles
const SCAN_HOP_MS = 4000; // time on each channel while scanning
const MAX_ANGLE = 60;
const SPOT_WIDTH = 7; // degrees either side of a sweet spot that still pull in a picture

const randomSpots = () => {
  const a = (Math.random() * 2 - 1) * 50;
  let b;
  do b = (Math.random() * 2 - 1) * 50;
  while (Math.abs(b - a) < 25);
  return [a, b];
};

/**
 * The antenna's effect on reception.
 *
 * `interference` (0 clean … 1 snow) drives the picture's static and the
 * hiss. While dragging, it eases off near a couple of hidden "sweet spot"
 * angles (fresh ones each drag). Letting go — or a tap, or R — searches
 * for about a second and then `onLock()` lands on a new channel. SCAN keeps
 * doing that every few seconds until stopped.
 */
const useRetune = ({ onLock }) => {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'dragging' | 'seeking'
  const [interference, setInterference] = useState(0);
  const [scanning, setScanning] = useState(false);
  const spotsRef = useRef(randomSpots());
  const seekTimerRef = useRef(null);
  const scanTimerRef = useRef(null);
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  const seek = useCallback(() => {
    clearTimeout(seekTimerRef.current);
    setPhase('seeking');
    setInterference(1);
    seekTimerRef.current = setTimeout(() => {
      onLockRef.current();
      setPhase('idle');
      setInterference(0);
    }, SEEK_MS);
  }, []);

  const beginDrag = useCallback(() => {
    clearTimeout(seekTimerRef.current);
    spotsRef.current = randomSpots();
    setPhase('dragging');
  }, []);

  const aim = useCallback((angle) => {
    const signal = Math.max(
      ...spotsRef.current.map((spot) => Math.exp(-((angle - spot) ** 2) / (2 * SPOT_WIDTH ** 2)))
    );
    // Even a sweet spot keeps a little snow while the antenna is moving.
    setInterference(Math.min(1, 1 - signal * 0.9));
  }, []);

  const stopScan = useCallback(() => {
    clearInterval(scanTimerRef.current);
    setScanning(false);
  }, []);

  const startScan = useCallback(() => {
    clearInterval(scanTimerRef.current);
    setScanning(true);
    seek();
    scanTimerRef.current = setInterval(seek, SCAN_HOP_MS);
  }, [seek]);

  const toggleScan = useCallback(() => (scanning ? stopScan() : startScan()), [scanning, stopScan, startScan]);

  useEffect(
    () => () => {
      clearTimeout(seekTimerRef.current);
      clearInterval(scanTimerRef.current);
    },
    []
  );

  return { phase, interference, scanning, beginDrag, aim, retune: seek, startScan, stopScan, toggleScan };
};

export const clampAntenna = (angle) => Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, angle));

export default useRetune;

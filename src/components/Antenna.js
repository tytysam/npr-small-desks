import React, { useCallback, useRef } from 'react';
import useAntennaGesture from '../hooks/useAntennaGesture';

/**
 * The 2D set's telescoping antenna. Swing it to hunt for a new station,
 * tap it (or focus it and press Enter) for a quick retune, or press and hold
 * to SCAN. `wobble` is bumped by the app to replay the wobble animation.
 */
const Antenna = ({ angle, wobble, onDragStart, onAim, onRelease, onTap, onHoldStart, onHoldEnd }) => {
  const baseRef = useRef(null);

  // Angle of the pointer around the mount, 0 = straight up, clockwise positive.
  const angleFromEvent = useCallback((e) => {
    const rect = baseRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(e.clientX - cx, cy - e.clientY) * 180) / Math.PI;
  }, []);

  const handlers = useAntennaGesture({ angleFromEvent, onDragStart, onAim, onRelease, onTap, onHoldStart, onHoldEnd });

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTap();
    }
  };

  return (
    <div
      className="tv-antenna"
      role="button"
      tabIndex={0}
      aria-label="Antenna: drag or tap to retune to a random channel, hold to scan"
      onKeyDown={onKeyDown}
      {...handlers}
    >
      <span className="tv-antenna-swing" style={{ transform: `rotate(${angle}deg)` }}>
        <span key={wobble} className={`tv-antenna-rod ${wobble ? 'is-wobbling' : ''}`} />
      </span>
      <span ref={baseRef} className="tv-antenna-base" />
    </div>
  );
};

export default Antenna;

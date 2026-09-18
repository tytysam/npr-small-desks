import React, { useRef, useCallback } from 'react';
import useKnobDrag from '../hooks/useKnobDrag';
import './Knob.css';

const SWEEP_DEG = 270;

// Map volume (0–1) onto a 270° sweep centred on twelve o'clock.
export const volumeToAngle = (vol) => vol * SWEEP_DEG - SWEEP_DEG / 2;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

const VolumeKnob = ({ volume, onVolumeChange }) => {
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const onDelta = useCallback(
    (delta) => {
      const next = clamp01(volumeRef.current + delta / SWEEP_DEG);
      if (next !== volumeRef.current) onVolumeChange(next);
    },
    [onVolumeChange]
  );

  const { ref, isDragging, handlers } = useKnobDrag({ onDelta, keyStep: 13.5, wheelStep: 9 });

  return (
    <div className="dial dial-volume">
      <div className="dial-ticks" aria-hidden="true">
        {Array.from({ length: 11 }, (_, i) => (
          <span
            key={i}
            className={`dial-tick ${i % 5 === 0 ? 'dial-tick-major' : ''}`}
            style={{ transform: `rotate(${-135 + i * 27}deg) translateY(-44px)` }}
          />
        ))}
      </div>
      <div
        ref={ref}
        className={`knob knob-volume ${isDragging ? 'knob-active' : ''}`}
        role="slider"
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(volume * 100)}
        tabIndex={0}
        style={{ transform: `rotate(${volumeToAngle(volume)}deg)` }}
        {...handlers}
      >
        <div className="knob-ridges" />
        <div className="knob-face" />
        <div className="knob-cap" />
        <div className="knob-indicator" />
      </div>
    </div>
  );
};

export default VolumeKnob;

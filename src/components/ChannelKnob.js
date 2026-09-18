import React, { useRef, useState, useCallback } from 'react';
import useKnobDrag from '../hooks/useKnobDrag';
import './Knob.css';

const DETENT_DEG = 30;
const CHANNEL_NUMBERS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

/**
 * Twelve-position VHF channel selector. Every 30° of rotation clicks to the
 * next detent and changes the channel in that direction.
 */
const ChannelKnob = ({ onChannelChange }) => {
  const [detent, setDetent] = useState(0);
  const accumulatedRef = useRef(0);

  const onDelta = useCallback(
    (delta) => {
      accumulatedRef.current += delta;
      while (Math.abs(accumulatedRef.current) >= DETENT_DEG) {
        const direction = accumulatedRef.current > 0 ? 1 : -1;
        accumulatedRef.current -= direction * DETENT_DEG;
        onChannelChange(direction);
        setDetent((prev) => prev + direction);
      }
    },
    [onChannelChange]
  );

  const onEnd = useCallback(() => {
    accumulatedRef.current = 0;
  }, []);

  const { ref, isDragging, handlers } = useKnobDrag({ onDelta, onEnd, keyStep: DETENT_DEG });

  return (
    <div className="dial dial-channel">
      <div className="dial-ring" aria-hidden="true">
        {CHANNEL_NUMBERS.map((n, i) => (
          <span
            key={n}
            className="dial-ring-number"
            style={{ transform: `rotate(${i * DETENT_DEG}deg) translateY(-62px) rotate(${-i * DETENT_DEG}deg)` }}
          >
            {n}
          </span>
        ))}
        <span className="dial-ring-pointer" />
      </div>
      <div
        ref={ref}
        className={`knob knob-channel ${isDragging ? 'knob-active' : ''}`}
        role="slider"
        aria-label="Channel"
        aria-valuemin={0}
        aria-valuemax={CHANNEL_NUMBERS.length - 1}
        aria-valuenow={((detent % CHANNEL_NUMBERS.length) + CHANNEL_NUMBERS.length) % CHANNEL_NUMBERS.length}
        tabIndex={0}
        style={{ transform: `rotate(${detent * DETENT_DEG}deg)` }}
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

export default ChannelKnob;

import { useRef, useCallback } from 'react';
import useKnobDrag from '../hooks/useKnobDrag';
import './Knob.css';

const DETENT_DEG = 30;
const CHANNEL_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Twelve-position channel selector, printed 1–12 (only printing: the dial
 * steps through the lineup whatever the numbers say). Every 30° of rotation clicks to the
 * next detent and changes the channel in that direction. `dialPosition` is
 * the app's cumulative detent count, so the dial also turns when the channel
 * changes some other way (keyboard, the other set).
 */
const ChannelKnob = ({ dialPosition = 0, onChannelChange }) => {
  const accumulatedRef = useRef(0);

  const onDelta = useCallback(
    (delta) => {
      accumulatedRef.current += delta;
      while (Math.abs(accumulatedRef.current) >= DETENT_DEG) {
        const direction = accumulatedRef.current > 0 ? 1 : -1;
        accumulatedRef.current -= direction * DETENT_DEG;
        onChannelChange(direction);
      }
    },
    [onChannelChange]
  );

  const onEnd = useCallback(() => {
    accumulatedRef.current = 0;
  }, []);

  const { ref, isDragging, handlers } = useKnobDrag({ onDelta, onEnd, keyStep: DETENT_DEG });

  const count = CHANNEL_NUMBERS.length;
  const detent = ((dialPosition % count) + count) % count;

  return (
    <div className="dial dial-channel">
      <div className="dial-ring" aria-hidden="true">
        {CHANNEL_NUMBERS.map((n, i) => (
          <span
            key={n}
            className="dial-ring-number"
            style={{ transform: `rotate(${i * DETENT_DEG}deg) translateY(-57px) rotate(${-i * DETENT_DEG}deg)` }}
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
        aria-valuemax={count - 1}
        aria-valuenow={detent}
        aria-valuetext={String(CHANNEL_NUMBERS[detent])}
        tabIndex={0}
        style={{ transform: `rotate(${dialPosition * DETENT_DEG}deg)` }}
        {...handlers}
      >
        <div className="knob-ridges" />
        <div className="knob-face" />
        {/* numbers printed on the knob itself, turning with it (shown only on
            the cream set's dish knob): anticlockwise, so the channel's sits
            at the top */}
        <div className="knob-numbers" aria-hidden="true">
          {CHANNEL_NUMBERS.map((n, i) => (
            <span key={n} className="knob-number" style={{ transform: `rotate(${-i * DETENT_DEG}deg) translateY(var(--knob-number-r))` }}>
              {n}
            </span>
          ))}
        </div>
        <div className="knob-pointer" />
        <div className="knob-cap" />
      </div>
    </div>
  );
};

export default ChannelKnob;

import React, { useRef, useCallback } from 'react';
import useKnobDrag from '../hooks/useKnobDrag';
import { BRIGHTNESS_MIN, BRIGHTNESS_MAX } from '../js/picture';

const SWEEP_DEG = 270;
const RANGE = BRIGHTNESS_MAX - BRIGHTNESS_MIN;

// Map brightness onto a 270° sweep centred on twelve o'clock (1.0 = straight up).
const toAngle = (b) => ((b - BRIGHTNESS_MIN) / RANGE) * SWEEP_DEG - SWEEP_DEG / 2;

/** The small black trim knob on the rail: picture brightness. */
const BrightnessKnob = ({ brightness, onBrightnessChange }) => {
  const brightnessRef = useRef(brightness);
  brightnessRef.current = brightness;

  const onDelta = useCallback(
    (delta) => onBrightnessChange(brightnessRef.current + (delta / SWEEP_DEG) * RANGE),
    [onBrightnessChange]
  );

  const { ref, isDragging, handlers } = useKnobDrag({ onDelta, keyStep: 13.5, wheelStep: 9 });

  return (
    <div
      ref={ref}
      className={`tv-mini-knob ${isDragging ? 'knob-active' : ''}`}
      role="slider"
      aria-label="Brightness"
      aria-valuemin={Math.round(BRIGHTNESS_MIN * 100)}
      aria-valuemax={Math.round(BRIGHTNESS_MAX * 100)}
      aria-valuenow={Math.round(brightness * 100)}
      tabIndex={0}
      style={{ transform: `rotate(${toAngle(brightness)}deg)` }}
      {...handlers}
    />
  );
};

export default BrightnessKnob;

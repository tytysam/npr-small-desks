import React, { useRef, useCallback, useState } from 'react';
import './Knob.css';

const ChannelKnob = ({ onChannelChange }) => {
  const knobRef = useRef(null);
  const [rotation, setRotation] = useState(0);
  const dragStartRef = useRef({ angle: 0 });
  const hasChangedRef = useRef(false);

  const getAngleFromEvent = useCallback((e, rect) => {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
  }, []);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const rect = knobRef.current.getBoundingClientRect();
    const angle = getAngleFromEvent(e, rect);
    dragStartRef.current = { angle };
    hasChangedRef.current = false;

    const handleMouseMove = (moveEvent) => {
      const currentAngle = getAngleFromEvent(moveEvent, rect);
      const delta = currentAngle - dragStartRef.current.angle;

      // Trigger channel change at 30° threshold (one detent)
      if (!hasChangedRef.current && Math.abs(delta) > 30) {
        hasChangedRef.current = true;
        const direction = delta > 0 ? 1 : -1;
        onChannelChange(direction);
        setRotation((prev) => prev + direction * 15);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [onChannelChange, getAngleFromEvent]);

  return (
    <div
      ref={knobRef}
      className="knob knob-channel"
      onMouseDown={handleMouseDown}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <div className="knob-indicator"></div>
    </div>
  );
};

export default ChannelKnob;

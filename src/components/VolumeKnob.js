import React, { useState, useRef, useCallback } from 'react';
import './Knob.css';

const VolumeKnob = ({ volume, onVolumeChange }) => {
  const knobRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ angle: 0, startVolume: 0 });

  // Map volume (0-1) to rotation angle (-135 to 135 degrees, 270° range)
  const volumeToAngle = (vol) => vol * 270 - 135;
  const angleToVolume = (angle) => Math.min(1, Math.max(0, (angle + 135) / 270));

  const getAngleFromEvent = useCallback((e, rect) => {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
  }, []);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const rect = knobRef.current.getBoundingClientRect();
    const angle = getAngleFromEvent(e, rect);
    dragStartRef.current = { angle, startVolume: volume };
    setIsDragging(true);

    const handleMouseMove = (moveEvent) => {
      const currentAngle = getAngleFromEvent(moveEvent, rect);
      const delta = currentAngle - dragStartRef.current.angle;
      const volumeDelta = delta / 270;
      const newVolume = Math.min(1, Math.max(0, dragStartRef.current.startVolume + volumeDelta));
      onVolumeChange(newVolume);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [volume, onVolumeChange, getAngleFromEvent]);

  const rotation = volumeToAngle(volume);

  return (
    <div
      ref={knobRef}
      className={`knob ${isDragging ? 'knob-active' : ''}`}
      onMouseDown={handleMouseDown}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <div className="knob-indicator"></div>
    </div>
  );
};

export default VolumeKnob;

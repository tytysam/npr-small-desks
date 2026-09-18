import React from 'react';
import './ModeToggle.css';

/**
 * Two-position rocker switch that flips the set between 2D and 3D.
 */
const ModeToggle = ({ mode, onChange, disabled }) => {
  const is3d = mode === '3d';
  const toggle = () => {
    if (disabled) return;
    onChange(is3d ? '2d' : '3d');
  };

  return (
    <div className="mode-toggle">
      <span className={`mode-toggle-label ${!is3d ? 'is-active' : ''}`}>2D</span>
      <button
        type="button"
        role="switch"
        aria-checked={is3d}
        aria-label="Toggle 3D television"
        className={`mode-toggle-switch ${is3d ? 'is-3d' : ''}`}
        onClick={toggle}
        disabled={disabled}
      >
        <span className="mode-toggle-rocker" />
      </button>
      <span className={`mode-toggle-label ${is3d ? 'is-active' : ''}`}>3D</span>
    </div>
  );
};

export default ModeToggle;

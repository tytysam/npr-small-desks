import React from 'react';
import './ModeToggle.css';

/**
 * Two-position rocker switch that flips the set between 2D and 3D.
 * `onIntent` fires on hover/focus, before a click, so the next set can be
 * fetched ahead of time.
 */
const ModeToggle = ({ mode, onChange, onIntent, disabled }) => {
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
        onPointerEnter={onIntent}
        onFocus={onIntent}
        disabled={disabled}
      >
        <span className="mode-toggle-rocker" />
      </button>
      <span className={`mode-toggle-label ${is3d ? 'is-active' : ''}`}>3D</span>
    </div>
  );
};

export default ModeToggle;

import React from 'react';
import './CrtTransition.css';

export const CRT_OFF_MS = 320;
export const CRT_ON_MS = 420;

/**
 * Full-viewport overlay that mimics a CRT powering down (picture collapses
 * to a bright line, then a dot) and back up. `phase` is 'idle' | 'off' | 'on'.
 */
const CrtTransition = ({ phase }) => {
  if (phase === 'idle') return null;
  return (
    <div className={`crt-transition crt-transition-${phase}`} aria-hidden="true">
      <div className="crt-transition-beam" />
    </div>
  );
};

export default CrtTransition;

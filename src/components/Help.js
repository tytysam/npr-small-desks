import React, { useEffect, useRef, forwardRef } from 'react';
import './Help.css';

const CONTROLS = [
  ['Channel dial', "Turn to flip channels. Everything's live, so anyone on the same channel is watching with you."],
  ['Volume knob', 'The set starts quiet; click anywhere for sound.'],
  ['Antenna', 'Wiggle it to land somewhere random. Hold it to scan.'],
  ['Lever', 'Down to pause, up to play.'],
  ['Slide switch', 'Power. (Also the classic fix for no signal.)'],
  ['Black knob', 'Brightness.'],
  ['Chrome knob by the badge', 'MENU: scanlines, VHS mode, Live vs. VCR.'],
  ['2D / 3D', 'Same set, in 3D. Drag to look around.'],
];

const KEYS = [
  ['↑↓', 'channel'],
  ['←→', 'volume'],
  ['M', 'mute'],
  ['Space', 'pause'],
  ['P', 'power'],
  ['R', 'retune'],
  ['S', 'scan'],
  ['L', 'last'],
  ['O', 'menu'],
];

/** The "?" plaque beside the 2D/3D toggle. Glows until it's been opened once. */
export const HelpButton = forwardRef(({ onClick, pulse }, ref) => (
  <button
    ref={ref}
    type="button"
    className={`help-button ${pulse ? 'is-pulsing' : ''}`}
    aria-label="How it works"
    aria-haspopup="dialog"
    onClick={onClick}
  >
    ?
  </button>
));
HelpButton.displayName = 'HelpButton';

/**
 * The owner's manual: a short card on how the set works. A modal dialog —
 * focus moves in and stays in until it closes (✕, Esc, or a click outside).
 */
export const HelpCard = ({ onClose }) => {
  const cardRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      // Keep Tab cycling within the card.
      const focusable = cardRef.current.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="help-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={cardRef} className="help-card" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <button ref={closeRef} type="button" className="help-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <h2 id="help-title" className="help-title">
          Operating your set
        </h2>
        <p className="help-model">Model NP-R1 · every Tiny Desk concert, on the air</p>

        <dl className="help-controls">
          {CONTROLS.map(([term, description]) => (
            <div key={term} className="help-control">
              <dt>{term}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>

        <p className="help-share">Share the address to put a friend on your channel.</p>

        <ul className="help-keys" aria-label="Keyboard shortcuts">
          {KEYS.map(([key, action]) => (
            <li key={key}>
              <kbd>{key}</kbd> {action}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

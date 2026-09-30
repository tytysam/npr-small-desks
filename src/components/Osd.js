import React from 'react';
import './Osd.css';

const SEGMENTS = 20;

const pad = (n) => String(n).padStart(2, '0');

const Bar = ({ label, value }) => {
  const lit = Math.round(value * SEGMENTS);
  return (
    <div className="osd-bar">
      <span className="osd-bar-label">{label}</span>
      <span className="osd-bar-track" aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i} className={`osd-bar-segment ${i < lit ? 'is-lit' : ''}`} />
        ))}
      </span>
      <span className="osd-bar-value">{pad(Math.round(value * 100))}</span>
    </div>
  );
};

/**
 * Phosphor-green on-screen display drawn inside the tube: channel and artist
 * on a change, level bars for volume/brightness, and standing PAUSE / MUTE
 * indicators. `flash` is the transient panel to show, if any.
 */
const Osd = ({ flash, channelNumber, artist, volume, brightness, paused, muted, hint }) => (
  <div className="osd">
    <div className="osd-top" aria-live="polite">
      {flash === 'channel' && channelNumber !== null && (
        <>
          <span className="osd-channel">CH {pad(channelNumber)}</span>
          <span className="osd-artist">{artist}</span>
        </>
      )}
    </div>

    <div className="osd-status">
      {paused && <span>❚❚ PAUSE</span>}
      {muted && <span>MUTE</span>}
    </div>

    <div className="osd-bottom">
      {flash === 'volume' && <Bar label="VOLUME" value={volume} />}
      {flash === 'brightness' && <Bar label="BRIGHT" value={brightness} />}
      {!flash && hint && <span className="osd-hint">{hint}</span>}
    </div>
  </div>
);

export default Osd;

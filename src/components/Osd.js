import React from 'react';
import { describeCrt } from '../js/crtSettings';
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
 * on a change (tagged LIVE for broadcast stations), level bars for
 * volume/brightness, and standing indicators (PAUSE, MUTE, SCAN, TUNING, and
 * the VHS deck's PLAY). `flash` is the transient panel to show, if any.
 */
const Osd = ({ flash, channelNumber, live, artist, volume, brightness, paused, muted, scanning, tuning, vhs, hint }) => (
  <div className="osd">
    <div className="osd-top" aria-live="polite">
      {flash === 'channel' && channelNumber !== null && (
        <>
          <span className="osd-channel">
            {live && <span className="osd-live">LIVE</span>}CH {pad(channelNumber)}
          </span>
          <span className="osd-artist">{artist}</span>
        </>
      )}
    </div>

    <div className="osd-status">
      {vhs && !paused && <span>PLAY ▶</span>}
      {paused && <span>❚❚ PAUSE</span>}
      {muted && <span>MUTE</span>}
      {scanning && <span className="osd-blink">SCAN</span>}
      {tuning && !scanning && <span className="osd-blink">TUNING</span>}
    </div>

    <div className="osd-bottom">
      {flash === 'volume' && <Bar label="VOLUME" value={volume} />}
      {flash === 'brightness' && <Bar label="BRIGHT" value={brightness} />}
      {!flash && hint && <span className="osd-hint">{hint}</span>}
    </div>
  </div>
);

const MenuLevel = ({ value }) => (
  <span className="osd-menu-level" aria-hidden="true">
    {Array.from({ length: 10 }, (_, i) => (
      <span key={i} className={`osd-bar-segment ${i < value ? 'is-lit' : ''}`} />
    ))}
  </span>
);

/**
 * The set's SETUP menu, drawn in the same phosphor style. It's driven by the
 * set's own controls: the channel control picks a row, the volume control
 * changes it, MENU closes it.
 */
export const SetupMenu = ({ items, selected, settings }) => (
  <div className="osd osd-menu" role="dialog" aria-label="Setup menu">
    <div className="osd-menu-title">SETUP</div>
    <ul className="osd-menu-rows">
      {items.map((item, i) => (
        <li key={item.key} className={i === selected ? 'is-selected' : ''} aria-current={i === selected || undefined}>
          <span className="osd-menu-label">{item.label}</span>
          {item.type === 'level' ? (
            <>
              <MenuLevel value={settings[item.key]} />
              <span className="osd-bar-value">{pad(settings[item.key])}</span>
            </>
          ) : (
            <span className="osd-menu-value">{describeCrt(settings, item)}</span>
          )}
        </li>
      ))}
    </ul>
    <div className="osd-menu-hint">CH ▲▼ select · VOL ◀▶ adjust · MENU exit</div>
  </div>
);

export default Osd;

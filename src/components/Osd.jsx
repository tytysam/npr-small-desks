import { describeCrt } from '../js/crtSettings';
import { clock, tapeCounter } from '../js/clock';
import useNow from '../hooks/useNow';
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

// The live bug's clock only shows minutes, so a few checks a minute keep it true.
const CLOCK_TICK_MS = 10000;

const LiveClock = () => <>{clock(useNow(CLOCK_TICK_MS))}</>;

/**
 * The standing corner bug that says how you're watching: a red-dotted LIVE
 * with the time on a broadcast station, or the VCR's tape counter.
 */
const ModeBug = ({ live, paused, tapeSeconds }) =>
  live ? (
    <span className="osd-bug is-live">
      <span className="osd-bug-dot" aria-hidden="true" />
      LIVE <LiveClock />
    </span>
  ) : (
    <span className="osd-bug is-vcr">
      <span className="osd-bug-glyph">{paused ? '❚❚' : '▶'}</span> {tapeCounter(tapeSeconds)}
    </span>
  );

const BANNERS = {
  live: ['LIVE TV', 'Joining the broadcast'],
  vcr: ['VCR', 'Playing from the top'],
  rejoin: ['LIVE', 'Rejoining the broadcast'],
};

/**
 * Phosphor-green on-screen display drawn inside the tube: the mode bug
 * (LIVE or the VCR counter) in the corner, channel and artist on a change,
 * level bars for volume/brightness, and standing indicators (PAUSE, MUTE,
 * SCAN, TUNING). On channel 000 (`signOff`) there's no bug. `flash` is the transient panel to show, if any; `banner`
 * announces a switch between Live and VCR ('mode') or rejoining a live
 * station after a pause ('rejoin').
 */
const Osd = ({ flash, banner, channelNumber, live, signOff = false, tapeSeconds = 0, artist, volume, brightness, paused, muted, scanning, tuning, hint }) => {
  const [bannerTitle, bannerSub] = BANNERS[banner === 'mode' ? (live ? 'live' : 'vcr') : banner] ?? [];
  return (
    <div className="osd">
      <div className="osd-top">
        {channelNumber !== null && !signOff && <ModeBug live={live} paused={paused} tapeSeconds={tapeSeconds} />}
        <div className="osd-now" aria-live="polite">
          {flash === 'channel' && channelNumber !== null && (
            <>
              <span className="osd-channel">CH {signOff ? '000' : pad(channelNumber)}</span>
              <span className="osd-artist">{artist}</span>
            </>
          )}
        </div>
      </div>

      <div className="osd-middle">
        <div className="osd-status">
          {paused && <span>❚❚ PAUSE</span>}
          {paused && live && <span className="osd-note">PLAY REJOINS LIVE</span>}
          {muted && <span>MUTE</span>}
          {scanning && <span className="osd-blink">SCAN</span>}
          {tuning && !scanning && <span className="osd-blink">TUNING</span>}
        </div>
        <div className="osd-banner-slot" aria-live="polite">
          {bannerTitle && (
            <div className="osd-banner">
              <span className="osd-banner-title">{bannerTitle}</span>
              <span className="osd-banner-sub">{bannerSub}</span>
            </div>
          )}
        </div>
      </div>

      <div className="osd-bottom">
        {flash === 'volume' && <Bar label="VOLUME" value={volume} />}
        {flash === 'brightness' && <Bar label="BRIGHT" value={brightness} />}
        {!flash && hint && <span className="osd-hint">{hint}</span>}
      </div>
    </div>
  );
};

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

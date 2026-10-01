import React from 'react';
import Screen from './Screen';
import VolumeKnob from './VolumeKnob';
import ChannelKnob from './ChannelKnob';
import BrightnessKnob from './BrightnessKnob';
import Antenna from './Antenna';
import useWoodImages from '../hooks/useWoodImages';
import './TV.css';

// The CSS wood shown until the shared grain (useWoodImages) is painted:
// feTurbulence has no source image, so these filters paint organic grain onto
// whatever element references them. Stretched horizontally for a veneer look;
// the fine variant is for the lighter honey-wood screen frame.
const WoodGrainFilters = () => (
  <svg className="tv-svg-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <filter id="tv-wood-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.010 0.42" numOctaves="4" seed="9" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.55" intercept="0" />
      </feComponentTransfer>
    </filter>
    <filter id="tv-wood-grain-fine" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.018 0.65" numOctaves="3" seed="23" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.35" intercept="0" />
      </feComponentTransfer>
    </filter>
  </svg>
);

/**
 * Mid-century wooden set, built like the 3D model: an overhanging top board,
 * a walnut cabinet whose raised rim frames a recessed front board, a slim
 * honey-wood bezel rolling in to a pillow-shaped tube, a recessed metal control
 * column with chrome knurled dials and a perforated speaker, a grooved lower
 * rail carrying the tuning strip (artist name) and pilot lamp, a telescoping
 * antenna, and a base on splayed slab legs. The TV guide lies on top. The wood is the same procedural
 * grain the 3D set uses.
 */
const TV = ({
  screen,
  volume,
  onVolumeChange,
  onChannelChange,
  dialPosition,
  brightness,
  onBrightnessChange,
  isOn,
  onPowerToggle,
  paused,
  onPauseToggle,
  onMenuToggle,
  menuOpen,
  artistName,
  antenna,
  guideOpen,
  onGuideOpen,
}) => {
  const wood = useWoodImages();
  const woodStyle = wood
    ? { '--wood-walnut': `url(${wood.walnut})`, '--wood-honey': `url(${wood.honey})`, '--wood-ready': 1 }
    : undefined;

  return (
    <div className="tv-set" style={woodStyle}>
      <WoodGrainFilters />

      <Antenna {...antenna} />

      {/* the TV guide, spine out on two older issues, as the 3D stack is */}
      <div className="tv-guide">
        <button
          type="button"
          className="tv-guide-spine tv-guide-book"
          aria-label="TV listings"
          aria-haspopup="dialog"
          aria-expanded={guideOpen}
          onClick={onGuideOpen}
        >
          NP-R1 Listings · Tiny Desk Weekly
        </button>
        <span className="tv-guide-spine tv-guide-issue-38" aria-hidden="true">
          NP-R1 Listings · No. 38
        </span>
        <span className="tv-guide-spine tv-guide-issue-37" aria-hidden="true">
          NP-R1 Listings · No. 37
        </span>
      </div>

      <div className="tv-top-board" aria-hidden="true" />

      <div className="tv-console">
        <div className="tv-board">
          <div className="tv-front">
            <div className="tv-frame">
              <div className="tv-tube">
                <Screen {...screen} />
              </div>
            </div>

            <div className="tv-column">
              <div className="knob-group">
                <ChannelKnob dialPosition={dialPosition} onChannelChange={onChannelChange} />
                <span className="knob-label">Channel</span>
              </div>

              <div className="knob-group">
                <VolumeKnob volume={volume} onVolumeChange={onVolumeChange} />
                <span className="knob-label">Volume</span>
              </div>

              <div className="tv-speaker" aria-hidden="true" />

              <button
                type="button"
                className={`tv-switch ${isOn ? 'is-on' : ''}`}
                role="switch"
                aria-checked={isOn}
                aria-label="Power"
                onClick={onPowerToggle}
              >
                <span className="tv-switch-slider" />
              </button>
            </div>
          </div>

          <div className="tv-rail">
            <div className="tv-badge">
              <button
                type="button"
                className={`tv-badge-knob ${menuOpen ? 'is-pressed' : ''}`}
                aria-label="Menu"
                aria-expanded={Boolean(menuOpen)}
                title="Menu"
                onClick={onMenuToggle}
              />
              <span className="tv-badge-text" aria-hidden="true">NP-R1</span>
            </div>

            <div className="tv-tuning-strip">
              <span className="tv-tuning-text">{artistName || 'Tiny Desk'}</span>
            </div>

            <div className="tv-louvres" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className="tv-louvre" />
              ))}
            </div>

            <button
              type="button"
              className={`tv-lever ${paused ? '' : 'is-up'}`}
              role="switch"
              aria-checked={!paused}
              aria-label="Play"
              title={paused ? 'Paused' : 'Playing'}
              onClick={onPauseToggle}
            >
              <span className="tv-lever-handle" />
              <span className="tv-lever-nut" />
            </button>

            <div className={`tv-lamp ${isOn ? 'is-on' : ''}`} title={isOn ? 'On' : 'Off'} />
            <BrightnessKnob brightness={brightness} onBrightnessChange={onBrightnessChange} />
          </div>
        </div>
      </div>

      <div className="tv-plinth" aria-hidden="true" />
      <div className="tv-legs" aria-hidden="true">
        <div className="tv-leg tv-leg-left" />
        <div className="tv-leg tv-leg-right" />
      </div>
    </div>
  );
};

export default TV;

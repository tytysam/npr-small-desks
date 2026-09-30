import React from 'react';
import Screen from './Screen';
import VolumeKnob from './VolumeKnob';
import ChannelKnob from './ChannelKnob';
import './TV.css';

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
 * Mid-century wooden set: walnut cabinet with an overhanging top lip, a
 * honey-wood picture frame around a pillow-shaped tube, a recessed metal
 * control column with chrome knurled dials and a perforated speaker, a lower
 * rail carrying the tuning strip (artist name) and pilot lamp, a telescoping
 * antenna and splayed legs.
 */
const TV = ({
  video,
  volume,
  onVolumeChange,
  onChannelChange,
  isLoading,
  error,
  artistName,
  isPlaying,
  resumeAt,
  onProgress,
  onPlay,
  onPause,
}) => {
  return (
    <div className="tv-set">
      <WoodGrainFilters />

      <div className="tv-antenna" aria-hidden="true">
        <span className="tv-antenna-rod" />
        <span className="tv-antenna-base" />
      </div>

      <div className="tv-console">
        <div className="tv-top-lip" aria-hidden="true" />

        <div className="tv-front">
          <div className="tv-frame">
            <div className="tv-tube">
              <Screen
                video={video}
                volume={volume}
                isLoading={isLoading}
                error={error}
                resumeAt={resumeAt}
                onProgress={onProgress}
                onPlay={onPlay}
                onPause={onPause}
                onEnded={() => onChannelChange(1)}
              />
            </div>
          </div>

          <div className="tv-column">
            <div className="knob-group">
              <ChannelKnob onChannelChange={onChannelChange} />
              <span className="knob-label">Channel</span>
            </div>

            <div className="knob-group">
              <VolumeKnob volume={volume} onVolumeChange={onVolumeChange} />
              <span className="knob-label">Volume</span>
            </div>

            <div className="tv-speaker" aria-hidden="true" />

            <div className="tv-switch" aria-hidden="true">
              <span className="tv-switch-slider" />
            </div>
          </div>
        </div>

        <div className="tv-rail">
          <div className="tv-badge" aria-hidden="true">
            <span className="tv-badge-knob" />
            <span className="tv-badge-text">NPR</span>
          </div>

          <div className="tv-tuning-strip">
            <span className="tv-tuning-text">{artistName || 'Tiny Desk'}</span>
          </div>

          <div className="tv-louvres" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="tv-louvre" />
            ))}
          </div>

          <div className={`tv-lamp ${isPlaying ? 'is-on' : ''}`} title={isPlaying ? 'On' : 'Standby'} />
          <span className="tv-mini-knob" aria-hidden="true" />
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

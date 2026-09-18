import React from 'react';
import Screen from './Screen';
import VolumeKnob from './VolumeKnob';
import ChannelKnob from './ChannelKnob';
import './TV.css';

// feTurbulence has no source image, so this filter paints organic grain onto
// whatever element references it. Stretched horizontally for a veneer look.
const WoodGrainFilter = () => (
  <svg className="tv-svg-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <filter id="tv-wood-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.010 0.42" numOctaves="4" seed="9" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.55" intercept="0" />
      </feComponentTransfer>
    </filter>
  </svg>
);

/**
 * Late-1970s walnut console: veneer cabinet, brushed-metal faceplate,
 * rounded CRT bezel, ribbed dials with a numbered channel ring, speaker
 * cloth and splayed legs.
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
      <WoodGrainFilter />
      <div className="tv-console">
        <div className="tv-faceplate">
          <div className="tv-bezel">
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

          <div className="tv-panel">
            <div className="tv-panel-top">
              <div className="tv-brandplate">NPR</div>
              <div className={`tv-lamp ${isPlaying ? 'is-on' : ''}`} title={isPlaying ? 'On' : 'Standby'} />
            </div>

            <div className="knob-group">
              <ChannelKnob onChannelChange={onChannelChange} />
              <span className="knob-label">Channel</span>
            </div>

            <div className="knob-group">
              <VolumeKnob volume={volume} onVolumeChange={onVolumeChange} />
              <span className="knob-label">Volume</span>
            </div>

            <div className="tv-buttons" aria-hidden="true">
              <div className="tv-button">
                <span className="tv-button-cap" />
                <span className="tv-button-label">Power</span>
              </div>
              <div className="tv-button">
                <span className="tv-button-cap" />
                <span className="tv-button-label">UHF</span>
              </div>
            </div>
          </div>
        </div>

        <div className="tv-lower">
          <div className="tv-grille" />
          <div className="tv-nameplate">
            <span className="tv-nameplate-text">{artistName || 'Tiny Desk'}</span>
          </div>
        </div>
      </div>

      <div className="tv-legs" aria-hidden="true">
        <div className="tv-leg tv-leg-1" />
        <div className="tv-leg tv-leg-2" />
        <div className="tv-leg tv-leg-3" />
        <div className="tv-leg tv-leg-4" />
      </div>
    </div>
  );
};

export default TV;

import React from 'react';
import Screen from './Screen';
import VolumeKnob from './VolumeKnob';
import ChannelKnob from './ChannelKnob';
import './TV.css';

const TV = ({ video, volume, onVolumeChange, onChannelChange, isLoading, error, artistName }) => {
  return (
    <div className="tv-container">
      <div className="tv-body">
        <div className="tv-screen-area">
          <div className="tv-bezel">
            <Screen video={video} volume={volume} isLoading={isLoading} error={error} onEnded={() => onChannelChange(1)} />
          </div>
        </div>
        <div className="tv-controls-panel">
          <div className="tv-brand">NPR</div>
          <div className="tv-knobs">
            <div className="knob-group">
              <label className="knob-label">VOL</label>
              <VolumeKnob volume={volume} onVolumeChange={onVolumeChange} />
            </div>
            <div className="knob-group">
              <label className="knob-label">CH</label>
              <ChannelKnob onChannelChange={onChannelChange} />
            </div>
          </div>
        </div>
      </div>
      <div className="tv-label">
        {artistName && <span className="tv-artist-name">{artistName}</span>}
      </div>
      <div className="tv-legs">
        <div className="tv-leg tv-leg-left"></div>
        <div className="tv-leg tv-leg-right"></div>
      </div>
    </div>
  );
};

export default TV;

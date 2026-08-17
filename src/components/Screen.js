import React, { useRef } from 'react';
import ReactPlayer from 'react-player';
import './Screen.css';

const Screen = ({ video, volume, isLoading, error, onEnded }) => {
  const playerRef = useRef(null);

  if (error) {
    return (
      <div className="screen screen-no-signal">
        <div className="no-signal-text">NO SIGNAL</div>
        <div className="no-signal-sub">Check antenna connection</div>
      </div>
    );
  }

  if (isLoading || !video) {
    return <div className="screen screen-black"></div>;
  }

  return (
    <div className="screen">
      <ReactPlayer
        ref={playerRef}
        url={`https://www.youtube.com/watch?v=${video.id.videoId}`}
        playing={true}
        muted={volume === 0}
        volume={volume}
        width="100%"
        height="100%"
        onEnded={onEnded}
        config={{
          youtube: {
            playerVars: {
              modestbranding: 1,
              rel: 0,
              controls: 0,
            },
          },
        }}
      />
    </div>
  );
};

export default Screen;

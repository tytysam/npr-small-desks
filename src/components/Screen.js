import React, { useRef, useEffect, useState, useCallback } from 'react';
import ReactPlayer from 'react-player';
import './Screen.css';

const STATIC_BURST_MS = 380;

// Three turbulence seeds cycled by CSS so the static appears to move.
const StaticNoise = () => (
  <svg className="screen-static" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      {[1, 2, 3].map((seed) => (
        <filter key={seed} id={`crt-static-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed * 17} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="2.2" intercept="-0.4" />
            <feFuncG type="linear" slope="2.2" intercept="-0.4" />
            <feFuncB type="linear" slope="2.2" intercept="-0.4" />
          </feComponentTransfer>
        </filter>
      ))}
    </defs>
    <rect className="screen-static-frame" width="400" height="300" filter="url(#crt-static-1)" />
    <rect className="screen-static-frame" width="400" height="300" filter="url(#crt-static-2)" />
    <rect className="screen-static-frame" width="400" height="300" filter="url(#crt-static-3)" />
  </svg>
);

// CRT dressing layered over whatever the screen is showing.
const CrtOverlays = ({ showStatic }) => (
  <>
    {showStatic && <StaticNoise />}
    <div className="screen-scanlines" aria-hidden="true" />
    <div className="screen-vignette" aria-hidden="true" />
    <div className="screen-glare" aria-hidden="true" />
  </>
);

/**
 * The picture tube. Shared by the 2D and 3D sets.
 *
 * `resumeAt` is honoured exactly once, when the player mounts, so that
 * switching 2D/3D (which remounts the iframe) resumes where it left off
 * without leaking a stale start time into later channel changes.
 */
const Screen = ({ video, volume, isLoading, error, onEnded, onProgress, onPlay, onPause, resumeAt = 0 }) => {
  const playerRef = useRef(null);
  const didSeekRef = useRef(false);
  const resumeAtRef = useRef(resumeAt);
  const [showStatic, setShowStatic] = useState(false);
  const videoId = video?.id?.videoId;
  const previousVideoIdRef = useRef(videoId);

  useEffect(() => {
    if (previousVideoIdRef.current === videoId) return;
    previousVideoIdRef.current = videoId;
    if (!videoId) return;
    setShowStatic(true);
    const timer = setTimeout(() => setShowStatic(false), STATIC_BURST_MS);
    return () => clearTimeout(timer);
  }, [videoId]);

  const handleReady = useCallback(() => {
    if (didSeekRef.current) return;
    didSeekRef.current = true;
    if (resumeAtRef.current > 0 && playerRef.current) {
      playerRef.current.seekTo(resumeAtRef.current, 'seconds');
    }
  }, []);

  if (error) {
    return (
      <div className="screen screen-no-signal">
        <div className="no-signal-text">NO SIGNAL</div>
        <div className="no-signal-sub">Check antenna connection</div>
        <CrtOverlays showStatic={false} />
      </div>
    );
  }

  if (isLoading || !video) {
    return (
      <div className="screen screen-black">
        <CrtOverlays showStatic={false} />
      </div>
    );
  }

  return (
    <div className="screen">
      <ReactPlayer
        ref={playerRef}
        url={`https://www.youtube.com/watch?v=${videoId}`}
        playing={true}
        muted={volume === 0}
        volume={volume}
        width="100%"
        height="100%"
        progressInterval={500}
        onReady={handleReady}
        onProgress={onProgress}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        config={{
          youtube: {
            playerVars: {
              modestbranding: 1,
              rel: 0,
              controls: 0,
              disablekb: 1,
              playsinline: 1,
              iv_load_policy: 3,
            },
          },
        }}
      />
      <CrtOverlays showStatic={showStatic} />
    </div>
  );
};

export default Screen;

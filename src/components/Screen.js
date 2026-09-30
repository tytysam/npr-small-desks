import React, { useRef, useEffect, useState, useCallback } from 'react';
import ReactPlayer from 'react-player';
import Osd from './Osd';
import './Screen.css';

const STATIC_BURST_MS = 380;

// Three turbulence seeds cycled by CSS so the static appears to move. While
// `tuning` it holds steady; otherwise it plays a short burst and fades.
const StaticNoise = ({ tuning = false }) => (
  <svg className={`screen-static ${tuning ? 'is-tuning' : ''}`} viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
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

/**
 * Tracks the tube through power changes: 'on' → 'powering-off' → 'off' →
 * 'warming' → 'on'. The in-between phases end when their animation does.
 */
const usePowerPhase = (isOn) => {
  const [phase, setPhase] = useState(isOn ? 'on' : 'off');
  const previousRef = useRef(isOn);

  useEffect(() => {
    if (previousRef.current === isOn) return;
    previousRef.current = isOn;
    setPhase(isOn ? 'warming' : 'powering-off');
  }, [isOn]);

  const onAnimationEnd = useCallback((e) => {
    if (e.target !== e.currentTarget) return;
    setPhase((p) => (p === 'warming' ? 'on' : p === 'powering-off' ? 'off' : p));
  }, []);

  return [phase, onAnimationEnd];
};

/**
 * The picture tube. Shared by the 2D and 3D sets.
 *
 * `resumeAt` is honoured exactly once, when the player mounts, so that
 * switching 2D/3D (which remounts the iframe) resumes where it left off
 * without leaking a stale start time into later channel changes.
 *
 * All controls live on the set, so none of YouTube's own UI should show:
 * the player is sized to fill the tube (cropping the 16:9 frame's sides),
 * a shield keeps the pointer from summoning its hover overlay, captions are
 * unloaded, and static covers the picture until each video actually plays —
 * hiding the title bar and "More videos" YouTube shows while loading.
 */
const Screen = ({
  video,
  volume,
  playing = true,
  isOn = true,
  brightness = 1,
  isLoading,
  error,
  onEnded,
  onProgress,
  resumeAt = 0,
  osd,
}) => {
  const playerRef = useRef(null);
  const didSeekRef = useRef(false);
  const resumeAtRef = useRef(resumeAt);
  const [showStatic, setShowStatic] = useState(false);
  const [startedId, setStartedId] = useState(null);
  const [powerPhase, onPowerAnimationEnd] = usePowerPhase(isOn);
  const videoId = video?.id;
  const tuning = Boolean(videoId) && !error && startedId !== videoId;

  // Static fades out over a moment once the picture comes in.
  useEffect(() => {
    if (tuning || !videoId) return undefined;
    setShowStatic(true);
    const timer = setTimeout(() => setShowStatic(false), STATIC_BURST_MS);
    return () => clearTimeout(timer);
  }, [tuning, videoId]);

  const hideCaptions = useCallback(() => {
    const player = playerRef.current?.getInternalPlayer();
    player?.unloadModule?.('captions');
    player?.unloadModule?.('cc');
  }, []);

  const handleReady = useCallback(() => {
    hideCaptions();
    if (didSeekRef.current) return;
    didSeekRef.current = true;
    if (resumeAtRef.current > 0 && playerRef.current) {
      playerRef.current.seekTo(resumeAtRef.current, 'seconds');
    }
  }, [hideCaptions]);

  // Captions load with each video, so unload them again as each one starts.
  const handlePlay = useCallback(() => {
    hideCaptions();
    setStartedId(videoId);
  }, [hideCaptions, videoId]);

  let picture;
  let variant = '';
  if (error) {
    variant = 'screen-no-signal';
    picture = (
      <>
        <div className="no-signal-text">NO SIGNAL</div>
        <div className="no-signal-sub">Searching for signal…</div>
      </>
    );
  } else if (isLoading || !video) {
    variant = 'screen-black';
  } else {
    picture = (
      <>
        <div className="screen-player">
          <ReactPlayer
            ref={playerRef}
            url={`https://www.youtube.com/watch?v=${videoId}`}
            playing={playing}
            muted={volume === 0}
            volume={volume}
            width="100%"
            height="100%"
            progressInterval={500}
            onReady={handleReady}
            onPlay={handlePlay}
            onProgress={onProgress}
            onEnded={onEnded}
            onError={onEnded /* skip videos that won't play (removed, region-locked) */}
            config={{
              youtube: {
                playerVars: {
                  modestbranding: 1,
                  rel: 0,
                  controls: 0,
                  disablekb: 1,
                  fs: 0,
                  playsinline: 1,
                  iv_load_policy: 3,
                  cc_load_policy: 0,
                },
              },
            }}
          />
        </div>
        <div className="screen-shield" aria-hidden="true" />
      </>
    );
  }

  return (
    <div className={`screen ${variant}`}>
      <div className="screen-picture" style={brightness !== 1 ? { filter: `brightness(${brightness})` } : undefined}>
        {picture}
      </div>
      {(tuning || showStatic) && isOn && <StaticNoise key={tuning ? 'tuning' : 'burst'} tuning={tuning} />}
      <div className="screen-scanlines" aria-hidden="true" />
      {osd && powerPhase === 'on' && <Osd {...osd} />}
      {powerPhase !== 'on' && (
        <div className={`screen-power screen-power-${powerPhase}`} onAnimationEnd={onPowerAnimationEnd} aria-hidden="true">
          <div className="screen-power-beam" />
        </div>
      )}
      <div className="screen-vignette" aria-hidden="true" />
      <div className="screen-glare" aria-hidden="true" />
    </div>
  );
};

export default Screen;

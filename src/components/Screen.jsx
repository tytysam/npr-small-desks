import { useRef, useEffect, useState, useCallback } from 'react';
import ReactPlayer from 'react-player';
import Osd, { SetupMenu } from './Osd';
import { CRT_DEFAULTS } from '../js/crtSettings';
import useLatest from '../hooks/useLatest';
import './Screen.css';

const STATIC_BURST_MS = 380;

// Three turbulence seeds cycled by CSS so the static appears to move. While
// `tuning` it holds steady; otherwise it plays a short burst and fades.
const StaticNoise = ({ tuning = false, opacity }) => (
  <svg
    className={`screen-static ${tuning ? 'is-tuning' : ''}`}
    style={opacity === undefined ? undefined : { opacity: 0.95 * opacity }}
    viewBox="0 0 400 300"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
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

const DEGAUSS_MS = 900;
// How thick the snow gets from antenna interference: the picture should stay
// faintly visible through it even at its worst. (Loading a new channel still
// shows full static.)
const ANTENNA_SNOW = 0.65;

// SETUP levels (0–10, 5 = the default look) → the tube's CSS variables.
const crtStyle = (crt, brightness) => ({
  '--scanline-alpha': (crt.scanlines * 0.045).toFixed(3),
  '--vignette-opacity': Math.min(1, 0.15 + crt.curvature * 0.17).toFixed(2),
  '--edge-shadow': `${crt.curvature * 4}px`,
  '--warmup': crt.warmup ? '2.2s' : '0.35s',
  '--picture-filter': `${crt.vhs ? 'saturate(1.35) contrast(1.08) blur(0.5px) ' : ''}brightness(${brightness})`,
});

/**
 * The picture tube. Shared by the 2D and 3D sets.
 *
 * `startAt` (seconds) rides in the video URL, so the player opens at that
 * moment — how live stations join mid-programme and VCR resumes after a
 * 2D/3D switch. A new start time on the same video reloads it there.
 *
 * All controls live on the set, so none of YouTube's own UI should show:
 * the player is sized to fill the tube (cropping the 16:9 frame's sides),
 * a shield keeps the pointer from summoning its hover overlay, captions stay
 * off (unless turned on in SETUP), and static covers the picture until each
 * video actually plays —
 * hiding the title bar and "More videos" YouTube shows while loading.
 *
 * `interference` (0–1, from the antenna) layers snow over the picture and
 * rolls it when reception is bad. `crt` holds the SETUP menu's settings;
 * `menu` renders that menu in place of the OSD.
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
  onPlayerPlay,
  onPlayerPause,
  startAt = 0,
  interference = 0,
  crt = CRT_DEFAULTS,
  menu = null,
  osd,
}) => {
  const playerRef = useRef(null);
  // The picture whose arrival burst (static, then degauss) has played out.
  const [staticDoneUrl, setStaticDoneUrl] = useState(null);
  const [degaussDoneUrl, setDegaussDoneUrl] = useState(null);
  const [startedUrl, setStartedUrl] = useState(null);
  const [powerPhase, onPowerAnimationEnd] = usePowerPhase(isOn);
  const videoId = video?.id;
  const start = Math.floor(startAt);
  const url = videoId ? `https://www.youtube.com/watch?v=${videoId}${start > 0 ? `&t=${start}` : ''}` : null;
  const tuning = Boolean(url) && !error && startedUrl !== url;

  // Once the picture comes in: the static fades out, and (if enabled) the
  // degauss coil shakes the colours for a moment. Only when a new picture
  // arrives: turning degauss on later doesn't replay it.
  const arrived = Boolean(url) && !tuning;
  const showStatic = arrived && staticDoneUrl !== url;
  const degaussing = arrived && crt.degauss && degaussDoneUrl !== url;
  useEffect(() => {
    if (!arrived) return undefined;
    const staticTimer = setTimeout(() => setStaticDoneUrl(url), STATIC_BURST_MS);
    const degaussTimer = setTimeout(() => setDegaussDoneUrl(url), DEGAUSS_MS);
    return () => {
      clearTimeout(staticTimer);
      clearTimeout(degaussTimer);
    };
  }, [arrived, url]);

  // Captions follow the SETUP setting: off by default to keep the picture
  // clean, or the video's English track (else its first) when turned on.
  const captionsRef = useLatest(crt.captions);
  const applyCaptions = useCallback(() => {
    const player = playerRef.current?.api; // the YouTube IFrame API player
    if (!player) return;
    if (!captionsRef.current) {
      player.setOption?.('captions', 'track', {});
      player.unloadModule?.('captions');
      player.unloadModule?.('cc');
      return;
    }
    player.loadModule?.('captions');
    // Always (re)select a track: after captions were hidden, YouTube can
    // still report one as current without showing it. The tracklist leaves
    // out auto-generated tracks (most Tiny Desk captions), so fall back to
    // English, which picks those up.
    const tracks = player.getOption?.('captions', 'tracklist') ?? [];
    const current = player.getOption?.('captions', 'track')?.languageCode;
    const listed = tracks.find((t) => t.languageCode?.startsWith('en')) ?? tracks[0];
    player.setOption?.('captions', 'track', { languageCode: current || listed?.languageCode || 'en' });
  }, [captionsRef]);

  useEffect(() => applyCaptions(), [crt.captions, applyCaptions]);

  // YouTube (re)loads its captions module lazily for each video and fires
  // onApiChange when it does — the moment to apply the setting again. The API
  // player exists by the time a video plays; listen once per player.
  const listenedApiRef = useRef(null);
  const handlePlay = useCallback(() => {
    const api = playerRef.current?.api;
    if (api && listenedApiRef.current !== api) {
      listenedApiRef.current = api;
      api.addEventListener?.('onApiChange', applyCaptions);
    }
    applyCaptions();
    setStartedUrl(url);
    onPlayerPlay?.();
  }, [applyCaptions, url, onPlayerPlay]);

  // When a video finishes, the player fires `pause` just before `ended`.
  // That's not the viewer pausing, so don't pass it on: the set would go
  // paused and the next video would load stopped.
  const handlePause = useCallback(() => {
    if (playerRef.current?.api?.getPlayerState?.() === 0) return; // YT.PlayerState.ENDED
    onPlayerPause?.();
  }, [onPlayerPause]);

  const handleTimeUpdate = useCallback(() => {
    onProgress?.({ playedSeconds: playerRef.current?.currentTime ?? 0 });
  }, [onProgress]);

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
        <div className="screen-player" data-video={videoId} data-start={start}>
          <ReactPlayer
            ref={playerRef}
            src={url}
            playing={playing}
            muted={volume === 0}
            volume={volume}
            width="100%"
            height="100%"
            onPlay={handlePlay}
            onPause={handlePause}
            onTimeUpdate={handleTimeUpdate}
            onEnded={onEnded}
            onError={onEnded /* skip videos that won't play (removed, region-locked) */}
            config={{
              // YouTube player parameters
              youtube: {
                modestbranding: 1,
                rel: 0,
                controls: 0,
                disablekb: 1,
                fs: 0,
                playsinline: 1,
                iv_load_policy: 3,
                cc_load_policy: 0,
              },
            }}
          />
        </div>
        <div className="screen-shield" aria-hidden="true" />
      </>
    );
  }

  const snow = isOn ? Math.max(interference, tuning || showStatic ? 1 : 0) : 0;
  const rolling = isOn && interference > 0.6;
  const pictureClass = ['screen-picture', rolling && 'is-rolling', degaussing && 'is-degaussing', crt.vhs && 'is-vhs']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`screen ${variant}`} style={crtStyle(crt, brightness)}>
      <div className={pictureClass}>{picture}</div>
      {snow > 0 && (
        <StaticNoise
          key={tuning || interference > 0 ? 'steady' : 'burst'}
          tuning={tuning || interference > 0}
          opacity={tuning ? 1 : interference > 0 ? interference * ANTENNA_SNOW : undefined}
        />
      )}
      {rolling && <div className="screen-rollbar" aria-hidden="true" />}
      {crt.vhs && isOn && video && !error && <div className="screen-vhs-band" aria-hidden="true" />}
      <div className="screen-scanlines" aria-hidden="true" />
      {powerPhase === 'on' && (menu ? <SetupMenu {...menu} /> : osd && <Osd {...osd} />)}
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

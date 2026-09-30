import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import TV from './components/TV';
import ModeToggle from './components/ModeToggle';
import CrtTransition, { CRT_OFF_MS, CRT_ON_MS } from './components/CrtTransition';
import useViewMode from './hooks/useViewMode';
import useChannels from './hooks/useChannels';
import usePersistentState from './hooks/usePersistentState';
import useOsd from './hooks/useOsd';
import useShortcuts from './hooks/useShortcuts';
import { pickRandomIndex } from './js/channels';
import { BRIGHTNESS_MIN, BRIGHTNESS_MAX } from './js/picture';
import './App.css';

// three.js and friends only load when the 3D set is first shown (or the
// toggle is hovered, which prefetches the chunk).
const load3D = () => import('./components/tv3d/TV3D');
const TV3D = lazy(load3D);

const VOLUME_STEP = 0.05;
const DEFAULT_VOLUME = 0.5;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isUnit = (v) => typeof v === 'number' && v >= 0 && v <= 1;
const isBrightness = (v) => typeof v === 'number' && v >= BRIGHTNESS_MIN && v <= BRIGHTNESS_MAX;
const isVideoId = (v) => typeof v === 'string' && v.length > 0;

function App() {
  const { channels, isLoading, error, retry } = useChannels();
  const [currentIndex, setCurrentIndex] = useState(null);
  // Cumulative detent count, so the dial turns the way the channel moved
  // (2D, 3D and keyboard all drive the same dial).
  const [dialPosition, setDialPosition] = useState(0);

  const [lastVideoId, setLastVideoId] = usePersistentState('npr-small-desk:lastVideo', null, isVideoId);
  const [savedVolume, setSavedVolume] = usePersistentState('npr-small-desk:volume', DEFAULT_VOLUME, isUnit);
  const [brightness, setBrightness] = usePersistentState('npr-small-desk:brightness', 1, isBrightness);

  // Browsers only autoplay muted, so the set starts silent and the first
  // gesture restores the remembered volume.
  const [volume, setVolume] = useState(0);
  const [soundUnlocked, setSoundUnlocked] = useState(false);

  const [isOn, setIsOn] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [osdFlash, flashOsd] = useOsd();

  const [viewMode, setViewMode] = useViewMode();
  const [transition, setTransition] = useState('idle'); // 'idle' | 'off' | 'on'
  const [resumeAt, setResumeAt] = useState(0);
  const playedSecondsRef = useRef(0);
  const transitionTimersRef = useRef([]);
  const initialVideoIdRef = useRef(lastVideoId);

  // Tune in once the lineup arrives: ?v= link, then last channel, then random.
  useEffect(() => {
    if (channels.length === 0) return;
    const indexOf = (id) => (id ? channels.findIndex((c) => c.id === id) : -1);
    const linked = new URLSearchParams(window.location.search).get('v');
    let index = indexOf(linked);
    if (index < 0) index = indexOf(initialVideoIdRef.current);
    if (index < 0) index = pickRandomIndex(channels.length);
    setCurrentIndex(index);
    flashOsd('channel');
  }, [channels, flashOsd]);

  const currentVideo = currentIndex === null ? null : channels[currentIndex] ?? null;
  const currentVideoId = currentVideo?.id;

  // Keep the address bar shareable and remember where we were.
  useEffect(() => {
    if (!currentVideoId) return;
    setLastVideoId(currentVideoId);
    const url = new URL(window.location.href);
    url.searchParams.set('v', currentVideoId);
    window.history.replaceState(null, '', url);
  }, [currentVideoId, setLastVideoId]);

  useEffect(() => {
    const timers = transitionTimersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  // First click or key press anywhere restores the remembered volume. Keys
  // that change volume themselves are left to do so.
  useEffect(() => {
    if (soundUnlocked) return undefined;
    const unlock = (e) => {
      if (e.type === 'keydown' && ['m', 'M', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        setSoundUnlocked(true);
        return;
      }
      setVolume((v) => (v === 0 ? savedVolume : v));
      setSoundUnlocked(true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
  }, [soundUnlocked, savedVolume]);

  const changeChannel = useCallback(
    (direction) => {
      if (channels.length === 0) return;
      playedSecondsRef.current = 0;
      setResumeAt(0);
      setIsPaused(false);
      setCurrentIndex((prev) => ((prev ?? 0) + direction + channels.length) % channels.length);
      setDialPosition((p) => p + direction);
      flashOsd('channel');
    },
    [channels.length, flashOsd]
  );

  const changeVolume = useCallback(
    (next) => {
      const v = clamp(next, 0, 1);
      setVolume(v);
      setSavedVolume(v);
      setSoundUnlocked(true);
      flashOsd('volume');
    },
    [setSavedVolume, flashOsd]
  );

  const toggleMute = useCallback(() => {
    setSoundUnlocked(true);
    // Muting is temporary, so it doesn't overwrite the remembered level.
    setVolume((v) => (v > 0 ? 0 : savedVolume > 0 ? savedVolume : DEFAULT_VOLUME));
    flashOsd('volume');
  }, [savedVolume, flashOsd]);

  const changeBrightness = useCallback(
    (next) => {
      setBrightness(clamp(next, BRIGHTNESS_MIN, BRIGHTNESS_MAX));
      flashOsd('brightness');
    },
    [setBrightness, flashOsd]
  );

  const togglePower = useCallback(() => {
    // Power-cycling a set that lost signal is the classic fix.
    if (!isOn && error) retry();
    setIsOn(!isOn);
  }, [isOn, error, retry]);

  // Works while the set is off too: it decides whether it resumes on power-up.
  const togglePause = useCallback(() => setIsPaused((p) => !p), []);

  const handleProgress = useCallback(({ playedSeconds }) => {
    playedSecondsRef.current = playedSeconds;
  }, []);

  const handleEnded = useCallback(() => changeChannel(1), [changeChannel]);

  // Power the whole view down, swap sets behind the black, then power back up.
  const requestModeChange = useCallback(
    (nextMode) => {
      if (transition !== 'idle' || nextMode === viewMode) return;
      setTransition('off');
      const swap = setTimeout(() => {
        setResumeAt(playedSecondsRef.current);
        setViewMode(nextMode);
        setTransition('on');
      }, CRT_OFF_MS);
      const settle = setTimeout(() => setTransition('idle'), CRT_OFF_MS + CRT_ON_MS);
      transitionTimersRef.current = [swap, settle];
    },
    [transition, viewMode, setViewMode]
  );

  useShortcuts({
    ArrowUp: () => changeChannel(1),
    ArrowDown: () => changeChannel(-1),
    ArrowRight: () => changeVolume(volume + VOLUME_STEP),
    ArrowLeft: () => changeVolume(volume - VOLUME_STEP),
    m: toggleMute,
    ' ': togglePause,
    p: togglePower,
  });

  const muted = volume === 0;
  const osd = {
    flash: osdFlash,
    channelNumber: currentIndex === null ? null : currentIndex + 1,
    artist: currentVideo?.artist ?? '',
    volume,
    brightness: (brightness - BRIGHTNESS_MIN) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN),
    paused: isPaused,
    muted: muted && (soundUnlocked || savedVolume === 0),
    hint: currentVideo && !error && muted && !soundUnlocked && savedVolume > 0 ? 'Click anywhere for sound' : null,
  };

  const setProps = {
    video: currentVideo,
    volume,
    onVolumeChange: changeVolume,
    onChannelChange: changeChannel,
    dialPosition,
    brightness,
    onBrightnessChange: changeBrightness,
    isOn,
    onPowerToggle: togglePower,
    paused: isPaused,
    onPauseToggle: togglePause,
    playing: isOn && !isPaused,
    isLoading,
    error,
    artistName: currentVideo?.artist ?? '',
    resumeAt,
    onProgress: handleProgress,
    onEnded: handleEnded,
    osd,
  };

  return (
    <div className="app">
      <ModeToggle
        mode={viewMode}
        onChange={requestModeChange}
        onIntent={viewMode === '2d' ? load3D : undefined}
        disabled={transition !== 'idle'}
      />
      {viewMode === '3d' ? (
        <Suspense fallback={<div className="tv-loading" />}>
          <TV3D {...setProps} />
        </Suspense>
      ) : (
        <TV {...setProps} />
      )}
      <CrtTransition phase={transition} />
    </div>
  );
}

export default App;

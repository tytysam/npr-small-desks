import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import TV from './components/TV';
import ModeToggle from './components/ModeToggle';
import { HelpButton, HelpCard } from './components/Help';
import { GuideBook } from './components/Guide';
import CrtTransition, { CRT_OFF_MS, CRT_ON_MS } from './components/CrtTransition';
import useViewMode from './hooks/useViewMode';
import useChannels from './hooks/useChannels';
import useTuner from './hooks/useTuner';
import useRetune, { clampAntenna } from './hooks/useRetune';
import useCrtSettings from './hooks/useCrtSettings';
import usePersistentState from './hooks/usePersistentState';
import useOsd from './hooks/useOsd';
import useShortcuts from './hooks/useShortcuts';
import { BRIGHTNESS_MIN, BRIGHTNESS_MAX } from './js/picture';
import { CRT_ITEMS } from './js/crtSettings';
import { setHiss } from './js/hiss';
import { mediaArtwork } from './js/thumbnails';
import './App.css';

// three.js and friends only load when the 3D set is first shown (or the
// toggle is hovered, which prefetches the chunk).
const load3D = () => import('./components/tv3d/TV3D');
const TV3D = lazy(load3D);

const VOLUME_STEP = 0.05;
const DEFAULT_VOLUME = 0.5;
const HISS_GAIN = 0.15; // a bed under the picture's sound, not a blast

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isUnit = (v) => typeof v === 'number' && v >= 0 && v <= 1;
const isBrightness = (v) => typeof v === 'number' && v >= BRIGHTNESS_MIN && v <= BRIGHTNESS_MAX;

function App() {
  const { channels, isLoading, error, retry } = useChannels();
  const [crt, adjustCrtSetting] = useCrtSettings();
  const tuner = useTuner({ channels, broadcast: crt.broadcast });
  const { station, program } = tuner;
  // Cumulative detent count, so the dial turns the way the channel moved
  // (2D, 3D and keyboard all drive the same dial).
  const [dialPosition, setDialPosition] = useState(0);

  const [savedVolume, setSavedVolume] = usePersistentState('npr-small-desk:volume', DEFAULT_VOLUME, isUnit);
  const [brightness, setBrightness] = usePersistentState('npr-small-desk:brightness', 1, isBrightness);

  // Browsers only autoplay muted, so the set starts silent and the first
  // gesture restores the remembered volume.
  const [volume, setVolume] = useState(0);
  const [soundUnlocked, setSoundUnlocked] = useState(false);

  const [isOn, setIsOn] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [osdFlash, flashOsd] = useOsd();
  const [menuIndex, setMenuIndex] = useState(null); // SETUP menu row, or null when closed
  const menuAdjustRef = useRef(0);

  const [antennaAngle, setAntennaAngle] = useState(0);
  const [antennaWobble, setAntennaWobble] = useState(0); // bumped to replay the wobble

  const [helpOpen, setHelpOpen] = useState(false);
  const [seenHelp, setSeenHelp] = usePersistentState('npr-small-desk:seenHelp', false, (v) => typeof v === 'boolean');
  const helpButtonRef = useRef(null);

  const [guideOpen, setGuideOpen] = useState(false);
  const [guideOrigin, setGuideOrigin] = useState(null); // where on screen the book grows from
  const guideReturnRef = useRef(null); // where focus goes back to when the guide closes

  const [viewMode, setViewMode] = useViewMode();
  const [transition, setTransition] = useState('idle'); // 'idle' | 'off' | 'on'
  const playedSecondsRef = useRef(0);
  const transitionTimersRef = useRef([]);

  const retune = useRetune({
    onLock: () => {
      tuner.jumpRandom();
      setIsPaused(false);
    },
  });

  // Show the channel whenever the picture changes: tuning, jumps, and the
  // next programme coming on air.
  const videoId = program?.video.id;
  useEffect(() => {
    if (station !== null) flashOsd('channel');
  }, [station, videoId, flashOsd]);

  // Switching Live/VCR picks the programme up from now.
  const broadcastRef = useRef(crt.broadcast);
  const { rejoin } = tuner;
  useEffect(() => {
    if (broadcastRef.current === crt.broadcast) return;
    broadcastRef.current = crt.broadcast;
    rejoin(0);
  }, [crt.broadcast, rejoin]);

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

  // Hiss rides on the interference, at the set's volume.
  useEffect(() => {
    setHiss(crt.hiss && isOn ? retune.interference * volume * HISS_GAIN : 0);
  }, [crt.hiss, isOn, retune.interference, volume]);

  // --- SETUP menu --------------------------------------------------------
  const menuOpen = menuIndex !== null;

  const toggleMenu = useCallback(() => {
    if (!isOn) return;
    menuAdjustRef.current = 0;
    setMenuIndex((i) => (i === null ? 0 : null));
  }, [isOn]);

  const closeMenu = useCallback(() => setMenuIndex(null), []);

  // --- channel -----------------------------------------------------------
  // While the menu is open the channel control selects rows (up = previous row).
  const changeChannel = useCallback(
    (direction) => {
      if (menuOpen) {
        setMenuIndex((i) => (i - direction + CRT_ITEMS.length) % CRT_ITEMS.length);
        return;
      }
      retune.stopScan();
      playedSecondsRef.current = 0;
      setIsPaused(false);
      tuner.step(direction);
      setDialPosition((p) => p + direction);
    },
    [menuOpen, retune, tuner]
  );

  const recallChannel = useCallback(() => {
    retune.stopScan();
    setIsPaused(false);
    tuner.recall();
  }, [retune, tuner]);

  // --- volume ------------------------------------------------------------
  // While the menu is open the volume control adjusts the selected row, one
  // step per VOLUME_STEP of travel.
  const changeVolume = useCallback(
    (next) => {
      if (menuOpen) {
        menuAdjustRef.current += next - volume;
        while (Math.abs(menuAdjustRef.current) >= VOLUME_STEP - 1e-6) {
          const direction = Math.sign(menuAdjustRef.current);
          menuAdjustRef.current -= direction * VOLUME_STEP;
          adjustCrtSetting(CRT_ITEMS[menuIndex].key, direction);
        }
        return;
      }
      const v = clamp(next, 0, 1);
      setVolume(v);
      setSavedVolume(v);
      setSoundUnlocked(true);
      flashOsd('volume');
    },
    [menuOpen, menuIndex, volume, adjustCrtSetting, setSavedVolume, flashOsd]
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

  // --- power and pause ---------------------------------------------------
  const togglePower = useCallback(() => {
    if (isOn) {
      retune.stopScan();
      setMenuIndex(null);
    } else {
      // Power-cycling a set that lost signal is the classic fix.
      if (error) retry();
      if (program?.live) tuner.rejoin();
    }
    setIsOn(!isOn);
  }, [isOn, error, retry, program, retune, tuner]);

  // Works while the set is off too: it decides whether it resumes on power-up.
  // Live TV doesn't wait for you, so resuming a live station rejoins it now.
  const togglePause = useCallback(() => {
    if (isPaused && program?.live) tuner.rejoin();
    setIsPaused(!isPaused);
  }, [isPaused, program, tuner]);

  // --- antenna -----------------------------------------------------------
  const retuneByHand = useCallback(() => {
    retune.stopScan();
    setAntennaWobble((w) => w + 1);
    retune.retune();
  }, [retune]);

  const antenna = {
    angle: antennaAngle,
    wobble: antennaWobble,
    onDragStart: () => {
      retune.stopScan();
      retune.beginDrag();
    },
    onAim: (angle) => {
      const a = clampAntenna(angle);
      setAntennaAngle(a);
      retune.aim(a);
    },
    onRelease: retune.retune,
    onTap: retuneByHand,
    onHoldStart: retune.startScan,
    onHoldEnd: retune.stopScan,
  };

  // --- lock screen and media keys -----------------------------------------
  // The Media Session shows what's on in the OS media controls (lock screen,
  // media hub) and routes media keys to the set: play/pause, and next /
  // previous as channel up / down.
  const nowShowing = program?.video ?? null;
  useEffect(() => {
    const session = navigator.mediaSession;
    if (!session || !nowShowing || station === null || typeof window.MediaMetadata !== 'function') return;
    session.metadata = new window.MediaMetadata({
      title: nowShowing.artist,
      artist: `Tiny Desk Concert · CH ${station + 1}${program.live ? ' · Live' : ''}`,
      album: 'NP-R1',
      artwork: mediaArtwork(nowShowing.id),
    });
  }, [nowShowing, station, program?.live]);

  useEffect(() => {
    if (navigator.mediaSession) navigator.mediaSession.playbackState = isOn && !isPaused ? 'playing' : 'paused';
  }, [isOn, isPaused]);

  const mediaActionsRef = useRef({});
  mediaActionsRef.current = {
    play: () => (isPaused ? togglePause() : !isOn && togglePower()),
    pause: () => !isPaused && togglePause(),
    nexttrack: () => changeChannel(1),
    previoustrack: () => changeChannel(-1),
  };
  useEffect(() => {
    const session = navigator.mediaSession;
    if (!session) return undefined;
    const actions = Object.keys(mediaActionsRef.current);
    actions.forEach((action) => {
      try {
        session.setActionHandler(action, () => mediaActionsRef.current[action]());
      } catch {
        // Not every browser supports every action.
      }
    });
    return () =>
      actions.forEach((action) => {
        try {
          session.setActionHandler(action, null);
        } catch {
          // ignore
        }
      });
  }, []);

  // Media keys and the lock screen usually reach YouTube's player directly,
  // pausing or playing the video without going through the set. Follow the
  // player, so the power switch, lever, PAUSE and the next toggle stay true to
  // the picture. Pauses the set causes itself (power off, the CRT mode switch)
  // are ignored.
  const playerSyncRef = useRef({});
  playerSyncRef.current = { isOn, isPaused, transition, live: Boolean(program?.live), rejoin: tuner.rejoin, togglePower };
  const handlePlayerPause = useCallback(() => {
    const { isOn: on, isPaused: paused, transition: phase } = playerSyncRef.current;
    if (on && !paused && phase === 'idle') setIsPaused(true);
  }, []);
  const handlePlayerPlay = useCallback(() => {
    const { isOn: on, isPaused: paused, live, rejoin: rejoinNow, togglePower: powerOn } = playerSyncRef.current;
    if (!on) {
      // Played while the set was off: switch it on (which also rejoins a live
      // station), with the lever up.
      powerOn();
      setIsPaused(false);
      return;
    }
    if (!paused) return;
    if (live) rejoinNow(); // live TV doesn't wait, as with the lever
    setIsPaused(false);
  }, []);

  // --- playback ----------------------------------------------------------
  const handleProgress = useCallback(({ playedSeconds }) => {
    playedSecondsRef.current = playedSeconds;
  }, []);

  // Power the whole view down, swap sets behind the black, then power back
  // up. Live stations rejoin the schedule; VCR resumes where it was.
  const requestModeChange = useCallback(
    (nextMode) => {
      if (transition !== 'idle' || nextMode === viewMode) return;
      setTransition('off');
      const swap = setTimeout(() => {
        if (program?.live) tuner.rejoin();
        else tuner.rejoin(playedSecondsRef.current);
        setViewMode(nextMode);
        setTransition('on');
      }, CRT_OFF_MS);
      const settle = setTimeout(() => setTransition('idle'), CRT_OFF_MS + CRT_ON_MS);
      transitionTimersRef.current = [swap, settle];
    },
    [transition, viewMode, setViewMode, program, tuner]
  );

  const openHelp = useCallback(() => {
    setHelpOpen(true);
    setSeenHelp(true);
  }, [setSeenHelp]);

  const closeHelp = useCallback(() => {
    setHelpOpen(false);
    helpButtonRef.current?.focus();
  }, []);

  // `origin`: the stack's centre and width on screen, when it was clicked.
  // From the keyboard, the 2D stack is found on the page; in 3D the book
  // just rises in.
  const openGuide = useCallback((origin) => {
    if (channels.length === 0) return;
    const book2D = document.querySelector('.tv-guide-book');
    const rect = book2D?.getBoundingClientRect();
    setGuideOrigin(origin ?? (rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width } : null));
    const active = document.activeElement;
    guideReturnRef.current = active && active !== document.body ? active : book2D;
    setMenuIndex(null);
    setHelpOpen(false);
    setGuideOpen(true);
  }, [channels.length]);

  const closeGuide = useCallback(() => {
    setGuideOpen(false);
    guideReturnRef.current?.focus?.();
  }, []);

  // Picking a listing tunes like the dial does (OSD, LAST, share link); the
  // book then folds itself shut.
  const tuneFromGuide = useCallback(
    (next, { fromTheTop = false } = {}) => {
      retune.stopScan();
      playedSecondsRef.current = 0;
      setIsPaused(false);
      if (fromTheTop) tuner.playVideo(next);
      else tuner.tuneTo(next);
      if (station !== null && next !== station) setDialPosition((p) => p + Math.sign(next - station));
    },
    [retune, tuner, station]
  );

  useShortcuts(
    {
      ArrowUp: () => changeChannel(1),
      ArrowDown: () => changeChannel(-1),
      ArrowRight: () => changeVolume(volume + VOLUME_STEP),
      ArrowLeft: () => changeVolume(volume - VOLUME_STEP),
      m: toggleMute,
      ' ': togglePause,
      p: togglePower,
      r: retuneByHand,
      s: retune.toggleScan,
      l: recallChannel,
      Backspace: recallChannel,
      o: toggleMenu,
      Escape: closeMenu,
      '?': openHelp,
      g: () => openGuide(),
    },
    { enabled: !helpOpen && !guideOpen }
  );

  // --- what the tube shows -----------------------------------------------
  const muted = volume === 0;
  const video = program?.video ?? null;
  const screen = {
    video,
    startAt: program?.startAt ?? 0,
    // The picture's sound drops away under the interference.
    volume: volume * (1 - retune.interference * 0.9),
    playing: isOn && !isPaused,
    isOn,
    brightness,
    isLoading,
    error,
    onProgress: handleProgress,
    onEnded: tuner.programEnded,
    onPlayerPlay: handlePlayerPlay,
    onPlayerPause: handlePlayerPause,
    interference: isOn ? retune.interference : 0,
    crt,
    menu: menuOpen ? { items: CRT_ITEMS, selected: menuIndex, settings: crt } : null,
    osd: {
      flash: osdFlash,
      channelNumber: station === null ? null : station + 1,
      live: Boolean(program?.live),
      artist: video?.artist ?? '',
      volume,
      brightness: (brightness - BRIGHTNESS_MIN) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN),
      paused: isPaused,
      muted: muted && (soundUnlocked || savedVolume === 0),
      scanning: retune.scanning,
      tuning: retune.phase === 'seeking',
      vhs: crt.vhs,
      hint: video && !error && muted && !soundUnlocked && savedVolume > 0 ? 'Click anywhere for sound' : null,
    },
  };

  const setProps = {
    screen,
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
    onMenuToggle: toggleMenu,
    menuOpen,
    artistName: video?.artist ?? '',
    antenna,
    guideOpen,
    onGuideOpen: openGuide,
  };

  return (
    <div className="app">
      <div className="app-controls">
        <HelpButton ref={helpButtonRef} onClick={openHelp} pulse={!seenHelp} />
        <ModeToggle
          mode={viewMode}
          onChange={requestModeChange}
          onIntent={viewMode === '2d' ? load3D : undefined}
          disabled={transition !== 'idle'}
        />
      </div>
      {viewMode === '3d' ? (
        <Suspense fallback={<div className="tv-loading" />}>
          <TV3D {...setProps} />
        </Suspense>
      ) : (
        <TV {...setProps} />
      )}
      {helpOpen && <HelpCard onClose={closeHelp} />}
      {guideOpen && (
        <GuideBook
          channels={channels}
          schedule={tuner.schedule}
          station={station}
          broadcast={crt.broadcast}
          origin={guideOrigin}
          onTune={tuneFromGuide}
          onPlayVideo={(index) => tuneFromGuide(index, { fromTheTop: true })}
          onClose={closeGuide}
        />
      )}
      <CrtTransition phase={transition} />
    </div>
  );
}

export default App;

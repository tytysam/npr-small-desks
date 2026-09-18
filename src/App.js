import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import TV from './components/TV';
import ModeToggle from './components/ModeToggle';
import CrtTransition, { CRT_OFF_MS, CRT_ON_MS } from './components/CrtTransition';
import useViewMode from './hooks/useViewMode';
import { fetchChannelList, parseArtistName, pickRandomIndex } from './js/fetchYoutubeVideos';
import './App.css';

// three.js and friends only load when the 3D set is first shown.
const TV3D = lazy(() => import('./components/tv3d/TV3D'));

function App() {
  const [channels, setChannels] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [volume, setVolume] = useState(0); // Start muted for autoplay
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [viewMode, setViewMode] = useViewMode();
  const [transition, setTransition] = useState('idle'); // 'idle' | 'off' | 'on'
  const [resumeAt, setResumeAt] = useState(0);
  const playedSecondsRef = useRef(0);
  const transitionTimersRef = useRef([]);

  useEffect(() => {
    const loadChannels = async () => {
      try {
        const items = await fetchChannelList();
        setChannels(items);
        setCurrentIndex(pickRandomIndex(items.length));
        setIsLoading(false);
      } catch (err) {
        setError(err);
        setIsLoading(false);
      }
    };
    loadChannels();
  }, []);

  useEffect(() => {
    const timers = transitionTimersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleChannelChange = useCallback((direction) => {
    playedSecondsRef.current = 0;
    setResumeAt(0);
    setIsPlaying(false);
    setCurrentIndex((prev) => {
      if (channels.length === 0) return prev;
      const next = prev + direction;
      if (next < 0) return channels.length - 1;
      if (next >= channels.length) return 0;
      return next;
    });
  }, [channels.length]);

  const handleProgress = useCallback(({ playedSeconds }) => {
    playedSecondsRef.current = playedSeconds;
  }, []);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);

  // Power the set down, swap it out behind the black, then power back up.
  const requestModeChange = useCallback((nextMode) => {
    if (transition !== 'idle' || nextMode === viewMode) return;
    setTransition('off');
    const swap = setTimeout(() => {
      setResumeAt(playedSecondsRef.current);
      setIsPlaying(false);
      setViewMode(nextMode);
      setTransition('on');
    }, CRT_OFF_MS);
    const settle = setTimeout(() => setTransition('idle'), CRT_OFF_MS + CRT_ON_MS);
    transitionTimersRef.current = [swap, settle];
  }, [transition, viewMode, setViewMode]);

  const currentVideo = channels[currentIndex] || null;
  const artistName = currentVideo
    ? parseArtistName(currentVideo.snippet.title)
    : '';

  const setProps = {
    video: currentVideo,
    volume,
    onVolumeChange: setVolume,
    onChannelChange: handleChannelChange,
    isLoading,
    error,
    artistName,
    isPlaying,
    resumeAt,
    onProgress: handleProgress,
    onPlay: handlePlay,
    onPause: handlePause,
  };

  return (
    <div className="app">
      <ModeToggle mode={viewMode} onChange={requestModeChange} disabled={transition !== 'idle'} />
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

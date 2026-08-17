import React, { useState, useEffect, useCallback } from 'react';
import TV from './components/TV';
import { fetchChannelList, parseArtistName, pickRandomIndex } from './js/fetchYoutubeVideos';
import './App.css';

function App() {
  const [channels, setChannels] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [volume, setVolume] = useState(0); // Start muted for autoplay
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const handleChannelChange = useCallback((direction) => {
    setCurrentIndex((prev) => {
      if (channels.length === 0) return prev;
      const next = prev + direction;
      if (next < 0) return channels.length - 1;
      if (next >= channels.length) return 0;
      return next;
    });
  }, [channels.length]);

  const currentVideo = channels[currentIndex] || null;
  const artistName = currentVideo
    ? parseArtistName(currentVideo.snippet.title)
    : '';

  return (
    <div className="app">
      <TV
        video={currentVideo}
        volume={volume}
        onVolumeChange={setVolume}
        onChannelChange={handleChannelChange}
        isLoading={isLoading}
        error={error}
        artistName={artistName}
      />
    </div>
  );
}

export default App;
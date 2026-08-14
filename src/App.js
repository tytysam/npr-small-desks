import React, { useState, useEffect } from 'react';
import SearchBar from './components/searchBar.js';
import VideoList from './components/videoList.js';
import VideoPlayer from './components/videoPlayer.js';

import fetchVideos from './js/fetchYoutubeVideos';

function App() {
    const [videos, setVideos] = useState([]);
    const [selectedVideo, setSelectedVideo] = useState(null);

    const handleSearch = async (query) => {
        const results = await fetchVideos(query);
        setVideos(results);
    };

    const handleVideoSelect = (video) => {
      setSelectedVideo(video);
    };

    return (
        <div>
            <SearchBar onSearch={handleSearch} />
            
            <div className="video-list">
                <VideoList videos={videos} onVideoSelect={handleVideoSelect} />
            </div>
            
            <div className="video-player">
                {selectedVideo && <VideoPlayer video={selectedVideo} />}
            </div>

        </div>
    );
}

export default App;
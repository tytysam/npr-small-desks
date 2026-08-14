import React from 'react';
import ReactPlayer from 'react-player';

const VideoPlayer = ({ video }) => {
    return (
        <div>
            <ReactPlayer url={`https://www.youtube.com/watch?v=${video.id.videoId}`} controls />
        </div>
    );
};

export default VideoPlayer;
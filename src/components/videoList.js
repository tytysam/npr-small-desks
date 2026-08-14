import React from 'react';
import ReactPlayer from 'react-player';

const VideoList = ({ videos, onVideoSelect }) => {
    return (
        <div>
            {videos.map((video) => (
                <div key={video.id.videoId} onClick={() => onVideoSelect(video)}>
                    {/* <ReactPlayer url={`https://www.youtube.com/watch?v=${video.id.videoId}`} light /> */}
                    <p>{video.snippet.title}</p>
                </div>
            ))}
        </div>
    );
};

export default VideoList;
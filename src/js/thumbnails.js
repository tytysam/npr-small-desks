/**
 * YouTube's still frames for a video, served from its image CDN: no API
 * call, no quota. `mq` is 320×180 (16:9), `hq` is 480×360 (4:3, letterboxed).
 */
export const thumbnailUrl = (videoId, size = 'mq') => `https://i.ytimg.com/vi/${videoId}/${size}default.jpg`;

/** Artwork for the Media Session (lock screen, OS media controls). */
export const mediaArtwork = (videoId) => [
  { src: thumbnailUrl(videoId, 'mq'), sizes: '320x180', type: 'image/jpeg' },
  { src: thumbnailUrl(videoId, 'hq'), sizes: '480x360', type: 'image/jpeg' },
];

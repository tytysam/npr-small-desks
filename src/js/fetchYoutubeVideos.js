import axios from 'axios';

const API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY;

export const fetchChannelList = async () => {
  const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
    params: {
      q: 'tiny desk',
      key: API_KEY,
      part: 'snippet',
      channelId: 'UC4eYXhJI4-7wSWc8UNRwD4A',
      type: 'video',
      maxResults: 50,
    },
  });
  return response.data.items;
};

export const parseArtistName = (title) => {
  const separators = [':', '|'];
  for (const sep of separators) {
    if (title.includes(sep)) {
      return title.split(sep)[0].trim();
    }
  }
  return title;
};

export const pickRandomIndex = (length) => Math.floor(Math.random() * length);

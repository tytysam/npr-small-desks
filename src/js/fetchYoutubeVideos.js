import axios from 'axios';

const API_KEY = 'AIzaSyD22MEI-MxB8FqBAk6qE4RuG_1GkO7k-Ic';

const fetchVideos = async (query) => {
    console.log("trying to fetchVideos!!! -> query: ", query)
    const response = await axios.get(`https://www.googleapis.com/youtube/v3/search`, {
        params: {
            q: "tiny desk",
            key: API_KEY,
            part: 'snippet',
            channelId: 'UC4eYXhJI4-7wSWc8UNRwD4A', // NPR
            type: 'video',
            maxResults: 50
        }
    });
    return response.data.items;
};

export default fetchVideos;
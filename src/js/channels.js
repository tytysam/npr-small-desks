/**
 * The channel lineup: every Tiny Desk concert, prebuilt into
 * public/channels.json by scripts/fetch-channels.mjs.
 *
 * Each entry is { id, title, artist, publishedAt, duration } — `id` is the
 * YouTube video id and `duration` is in seconds.
 */
export const fetchChannelList = async () => {
  const response = await fetch(`${process.env.PUBLIC_URL}/channels.json`);
  if (!response.ok) throw new Error(`channels.json: ${response.status}`);
  const { channels } = await response.json();
  if (!channels?.length) throw new Error('channels.json has no channels');
  return channels;
};

export const pickRandomIndex = (length) => Math.floor(Math.random() * length);

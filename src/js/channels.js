/**
 * The channel lineup: every Tiny Desk concert, prebuilt into
 * public/channels.json by scripts/fetch-channels.mjs.
 *
 * Each entry is { id, title, artist, publishedAt, duration } — `id` is the
 * YouTube video id and `duration` is in seconds.
 */
export const fetchChannelList = async () => {
  const response = await fetch(`${import.meta.env.BASE_URL}channels.json`);
  if (!response.ok) throw new Error(`channels.json: ${response.status}`);
  const { channels } = await response.json();
  if (!channels?.length) throw new Error('channels.json has no channels');
  return channels;
};

export const pickRandomIndex = (length) => Math.floor(Math.random() * length);

/**
 * Channel 000, below channel 1: where the set signs off for the night (color
 * bars, then the credits). The dial stops here between the last channel and
 * the first; the guide's CH box, a search and `?ch=0` find it too.
 */
export const SIGN_OFF = -1;

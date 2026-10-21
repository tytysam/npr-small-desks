const pad = (n) => String(n).padStart(2, '0');

/** Wall-clock time as the listings print it: "8:42 PM", in the viewer's locale. */
export const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** A VCR's tape counter: hours, minutes and seconds played, "0:12:34". */
export const tapeCounter = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
};

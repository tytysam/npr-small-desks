/**
 * Tuning hiss: filtered white noise synthesised with Web Audio, so there's
 * no audio file to load. One shared instance; the AudioContext is created
 * lazily on first use (always inside a user gesture here) because browsers
 * won't start audio before one.
 */
let ctx = null;
let gain = null;

const start = () => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return false;
  ctx = new AudioContext();
  const seconds = 2;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  // Band-limit it: TV hiss is bright but not piercing.
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 400;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 7000;
  gain = ctx.createGain();
  gain.gain.value = 0;
  noise.connect(highpass).connect(lowpass).connect(gain).connect(ctx.destination);
  noise.start();
  return true;
};

/** Set the hiss loudness (0 = silent), smoothed to avoid clicks. */
export const setHiss = (level) => {
  if (!ctx) {
    if (level <= 0 || !start()) return;
  }
  if (ctx.state === 'suspended') ctx.resume();
  gain.gain.setTargetAtTime(Math.max(0, level), ctx.currentTime, 0.05);
};

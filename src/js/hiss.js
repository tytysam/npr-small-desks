/**
 * The set's synthesised sounds, so there's no audio file to load: the tuning
 * hiss (filtered white noise) and the sign-off's 1 kHz test tone. They share
 * one AudioContext, created lazily on first use (always inside a user
 * gesture here) because browsers won't start audio before one.
 */
let ctx = null;
let hissGain = null;
let toneGain = null;

const audio = () => {
  if (ctx) return ctx;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  ctx = new AudioContext();
  return ctx;
};

const silentGain = () => {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);
  return gain;
};

const startHiss = () => {
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
  hissGain = silentGain();
  noise.connect(highpass).connect(lowpass).connect(hissGain);
  noise.start();
};

const startTone = () => {
  const oscillator = ctx.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = 1000;
  toneGain = silentGain();
  oscillator.connect(toneGain);
  oscillator.start();
};

// Smoothed, to avoid clicks.
const fade = (gain, level) => {
  if (ctx.state === 'suspended') ctx.resume();
  gain.gain.setTargetAtTime(Math.max(0, level), ctx.currentTime, 0.05);
};

/** Set the hiss loudness (0 = silent). */
export const setHiss = (level) => {
  if (!hissGain) {
    if (level <= 0 || !audio()) return;
    startHiss();
  }
  fade(hissGain, level);
};

/** Set the test tone's loudness (0 = silent). */
export const setTone = (level) => {
  if (!toneGain) {
    if (level <= 0 || !audio()) return;
    startTone();
  }
  fade(toneGain, level);
};

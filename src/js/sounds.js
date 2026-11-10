/**
 * The set's synthesised sounds, so there's no audio file to load: the tuning
 * hiss (filtered white noise), the sign-off's 1 kHz test tone, and the
 * controls' mechanical clicks. They share one AudioContext, created lazily on
 * first audible use (always after a user gesture here) because browsers won't
 * start audio before one.
 */
let ctx = null;
let hissGain = null;
let toneGain = null;
let noiseBuffer = null;

const audio = () => {
  if (ctx) return ctx;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  ctx = new AudioContext();
  return ctx;
};

const resume = () => {
  if (ctx.state === 'suspended') ctx.resume();
};

const silentGain = () => {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);
  return gain;
};

// Two seconds of white noise, shared by the hiss and every click.
const noise = () => {
  if (noiseBuffer) return noiseBuffer;
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
};

const startHiss = () => {
  const source = ctx.createBufferSource();
  source.buffer = noise();
  source.loop = true;
  // Band-limit it: TV hiss is bright but not piercing.
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 400;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 7000;
  hissGain = silentGain();
  source.connect(highpass).connect(lowpass).connect(hissGain);
  source.start();
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
  resume();
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

// --- control sounds --------------------------------------------------------
// Every sound is a few one-shot nodes scheduled to stop on their own, so the
// browser frees them once they finish.

// A quick attack and an exponential decay to silence over `dur` seconds.
const envelope = (at, level, dur) => {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  return gain;
};

/** A burst of noise through a band-pass filter: the tick of plastic on metal. */
const click = (out, at, { freq, q = 3, dur, gain, sweepTo }) => {
  const source = ctx.createBufferSource();
  source.buffer = noise();
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(freq, at);
  if (sweepTo) band.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
  band.Q.value = q;
  source.connect(band).connect(envelope(at, gain, dur)).connect(out);
  // Start somewhere random in the noise so repeats don't sound identical.
  source.start(at, Math.random() * 1.5);
  source.stop(at + dur + 0.01);
};

/** A sine that drops in pitch as it dies away: the body of a heavy switch. */
const thump = (out, at, { freq, dur, gain }) => {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 1.6, at);
  osc.frequency.exponentialRampToValueAtTime(freq, at + dur * 0.4);
  osc.connect(envelope(at, gain, dur)).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.01);
};

/**
 * The recipes, one per control. Each layer is [kind, delay (s), options];
 * `gain` is relative to the set's click level. Tweak sounds here.
 */
export const SOUNDS = {
  // The channel dial's detent: short, dry and a little bright.
  detent: [['click', 0, { freq: 3200, q: 4, dur: 0.018, gain: 0.9 }]],
  // Volume and brightness, and SETUP adjustments: barely there.
  tick: [['click', 0, { freq: 4200, q: 5, dur: 0.01, gain: 0.25 }]],
  // The power switch: a low thump under a click; on is a touch brighter.
  powerOn: [
    ['thump', 0, { freq: 95, dur: 0.12, gain: 0.9 }],
    ['click', 0, { freq: 1900, q: 2, dur: 0.03, gain: 0.7 }],
    ['click', 0.012, { freq: 2700, q: 3, dur: 0.015, gain: 0.35 }],
  ],
  powerOff: [
    ['thump', 0, { freq: 80, dur: 0.14, gain: 0.9 }],
    ['click', 0, { freq: 1400, q: 2, dur: 0.035, gain: 0.7 }],
  ],
  // The play/pause lever: a sharp snap and its echo off the stop.
  lever: [
    ['click', 0, { freq: 2600, q: 3, dur: 0.012, gain: 0.8 }],
    ['click', 0.022, { freq: 3600, q: 4, dur: 0.008, gain: 0.4 }],
  ],
  // MENU and ♥: a muffled push, and a lighter click as the button pops out.
  press: [
    ['click', 0, { freq: 1500, q: 2, dur: 0.02, gain: 0.6 }],
    ['thump', 0, { freq: 220, dur: 0.03, gain: 0.25 }],
  ],
  release: [['click', 0, { freq: 2200, q: 3, dur: 0.012, gain: 0.4 }]],
  // The TV/VCR slide: a short scrape.
  slide: [['click', 0, { freq: 1200, q: 1.5, dur: 0.07, gain: 0.5, sweepTo: 3000 }]],
};

const LAYERS = { click, thump };

/**
 * `(name, now)` → whether a sound may play: at most one of each per `gap`
 * seconds, so a fast dial or a held arrow key rattles rather than buzzes.
 */
export const makeThrottle = (gap) => {
  const last = new Map();
  return (name, now) => {
    if (now - (last.get(name) ?? -Infinity) < gap) return false;
    last.set(name, now);
    return true;
  };
};

const throttle = makeThrottle(0.03);

/** Play one of SOUNDS at `level` (the set's volume times the click gain; 0 = silent). */
export const playSound = (name, level) => {
  if (!(level > 0) || !SOUNDS[name] || !audio()) return;
  // Wall-clock time: the audio clock stands still while the context resumes.
  if (!throttle(name, performance.now() / 1000)) return;
  resume();
  const at = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = level;
  out.connect(ctx.destination);
  let end = 0;
  SOUNDS[name].forEach(([kind, delay, options]) => {
    LAYERS[kind](out, at + delay, options);
    end = Math.max(end, delay + options.dur);
  });
  // The layers stop themselves; unhook the bus once they have.
  setTimeout(() => out.disconnect(), (end + 0.1) * 1000);
};

/** Whether a knob moving from `prev` to `next` passed a step mark (one tick per step). */
export const crossedStep = (prev, next, step) => Math.round(prev / step) !== Math.round(next / step);

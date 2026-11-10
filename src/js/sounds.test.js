import { makeThrottle, crossedStep, playSound, SOUNDS } from './sounds';

describe('makeThrottle', () => {
  test('lets one of each sound through per gap', () => {
    const allow = makeThrottle(0.03);
    expect(allow('detent', 1)).toBe(true);
    expect(allow('detent', 1.01)).toBe(false);
    expect(allow('lever', 1.01)).toBe(true);
    expect(allow('detent', 1.04)).toBe(true);
  });
});

describe('crossedStep', () => {
  test('ticks once per step mark passed', () => {
    expect(crossedStep(0.5, 0.55, 0.05)).toBe(true);
    expect(crossedStep(0.5, 0.51, 0.05)).toBe(false);
    expect(crossedStep(0.51, 0.53, 0.05)).toBe(true);
    expect(crossedStep(0.3, 0.3, 0.05)).toBe(false);
  });
});

// A stand-in for Web Audio that records what each sound builds.
const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
const made = [];
class FakeContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.state = 'running';
    this.destination = {};
  }
  node(kind, extra = {}) {
    const n = { kind, connected: [], started: false, stopped: false, gain: param(), frequency: param(), Q: param(), ...extra };
    n.connect = (to) => (n.connected.push(to), to);
    n.disconnect = () => (n.connected = []);
    n.start = () => (n.started = true);
    n.stop = () => (n.stopped = true);
    made.push(n);
    return n;
  }
  createGain() { return this.node('gain'); }
  createBiquadFilter() { return this.node('filter'); }
  createOscillator() { return this.node('osc'); }
  createBufferSource() { return this.node('source'); }
  createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
}

describe('playSound', () => {
  beforeAll(() => {
    globalThis.window = { AudioContext: FakeContext };
  });
  afterAll(() => {
    delete globalThis.window;
  });
  beforeEach(() => {
    made.length = 0;
  });

  test('is silent, and starts no audio, at level 0', () => {
    playSound('detent', 0);
    expect(made).toHaveLength(0);
  });

  test.each(Object.keys(SOUNDS))('%s builds layers that stop on their own', (name) => {
    vi.useFakeTimers();
    playSound(name, 0.5);
    const sources = made.filter((n) => n.kind === 'source' || n.kind === 'osc');
    expect(sources).toHaveLength(SOUNDS[name].length);
    sources.forEach((s) => expect(s.started && s.stopped).toBe(true));
    const bus = made[0];
    expect(bus.gain.value).toBe(0.5);
    expect(bus.connected).toHaveLength(1);
    vi.runAllTimers();
    expect(bus.connected).toHaveLength(0);
    vi.useRealTimers();
  });
});

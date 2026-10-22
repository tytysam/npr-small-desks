// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import useTuner from './useTuner';
import { SIGN_OFF } from '../js/channels';

const channels = Array.from({ length: 5 }, (_, i) => ({ id: `video-${i}`, artist: `Artist ${i + 1}`, title: '', duration: 600 }));
const LAST_STATION = 'npr-small-desk:lastStation';

const tuner = (search = '') => {
  window.history.replaceState(null, '', `/${search}`);
  return renderHook(() => useTuner({ channels, broadcast: true })).result;
};

describe('useTuner: channel 000, the sign-off', () => {
  beforeEach(() => localStorage.clear());

  test('a ?ch=0 link tunes to it, and it keeps that link', () => {
    const result = tuner('?ch=0');
    expect(result.current.station).toBe(SIGN_OFF);
    expect(result.current.program).toMatchObject({ signOff: true, video: null, live: false });
    expect(window.location.search).toBe('?ch=0');
  });

  test("it isn't remembered as the last channel", () => {
    const result = tuner('?ch=3');
    act(() => result.current.tuneTo(SIGN_OFF));
    expect(result.current.program.signOff).toBe(true);
    expect(JSON.parse(localStorage.getItem(LAST_STATION))).toBe(2);
  });

  test('channel up leaves it for the first channel, down for the last', () => {
    const result = tuner('?ch=0');
    act(() => result.current.step(1));
    expect(result.current.station).toBe(0);
    act(() => result.current.tuneTo(SIGN_OFF));
    act(() => result.current.step(-1));
    expect(result.current.station).toBe(channels.length - 1);
  });

  test('the dial stops on it where it wraps, either way round', () => {
    const result = tuner('?ch=1');
    act(() => result.current.step(-1));
    expect(result.current.station).toBe(SIGN_OFF);
    act(() => result.current.step(-1));
    expect(result.current.station).toBe(channels.length - 1);
    act(() => result.current.step(1));
    expect(result.current.station).toBe(SIGN_OFF);
    act(() => result.current.step(1));
    expect(result.current.station).toBe(0);
  });

  test('a tape that ends moves on to channel 1, not the sign-off', () => {
    window.history.replaceState(null, '', `/?ch=${channels.length}`);
    const { result } = renderHook(() => useTuner({ channels, broadcast: false }));
    act(() => result.current.programEnded());
    expect(result.current.station).toBe(0);
  });
});

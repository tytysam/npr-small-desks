// @vitest-environment jsdom
import { render, act } from '@testing-library/react';
import Screen from './Screen';

// A stand-in for react-player: records the props Screen hands it and exposes
// a fake YouTube API player through the ref, with a settable state.
const player = vi.hoisted(() => ({ props: null, state: 1, api: null }));
vi.mock('react-player', async () => {
  const { useImperativeHandle } = await import('react');
  const FakePlayer = ({ ref, ...props }) => {
    useImperativeHandle(ref, () => ({ api: player.api, loadComplete: Promise.resolve() }));
    player.props = props;
    return null;
  };
  return { default: FakePlayer };
});

const YT_PLAYING = 1;
const YT_PAUSED = 2;
const YT_ENDED = 0;

const renderScreen = () => {
  const onEnded = vi.fn();
  const onPlayerPause = vi.fn();
  render(<Screen video={{ id: 'video-1' }} volume={0.5} onEnded={onEnded} onPlayerPause={onPlayerPause} />);
  return { onEnded, onPlayerPause };
};

describe('Screen', () => {
  beforeEach(() => {
    player.state = YT_PLAYING;
    player.api = { getPlayerState: () => player.state, loadVideoById: vi.fn(), cueVideoById: vi.fn() };
  });

  // A new src would build a new iframe, which Chrome won't start while the
  // window is hidden; the next programme has to load into the one playing.
  it('loads the next programme into the same player', async () => {
    const { rerender } = render(<Screen video={{ id: 'video-1' }} volume={0.5} />);
    const firstSrc = player.props.src;
    rerender(<Screen video={{ id: 'video-2' }} volume={0.5} startAt={42} />);
    await act(async () => {});
    expect(player.props.src).toBe(firstSrc);
    expect(player.api.loadVideoById).toHaveBeenCalledWith({ videoId: 'video-2', startSeconds: 42 });
  });

  it('cues rather than plays the next programme while paused', async () => {
    const { rerender } = render(<Screen video={{ id: 'video-1' }} volume={0.5} playing={false} />);
    rerender(<Screen video={{ id: 'video-2' }} volume={0.5} playing={false} />);
    await act(async () => {});
    expect(player.api.cueVideoById).toHaveBeenCalledWith({ videoId: 'video-2', startSeconds: 0 });
    expect(player.api.loadVideoById).not.toHaveBeenCalled();
  });

  it('shows the sign-off, not a player, on channel 000', () => {
    player.props = null;
    const { getByLabelText } = render(<Screen video={null} signOff volume={0.5} />);
    expect(getByLabelText('Color bars')).toBeInTheDocument();
    expect(player.props).toBeNull();
  });

  it("doesn't pass on the pause YouTube fires as a video ends", () => {
    const { onEnded, onPlayerPause } = renderScreen();
    player.state = YT_ENDED;
    player.props.onPause();
    player.props.onEnded();
    expect(onPlayerPause).not.toHaveBeenCalled();
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('passes on a real pause (media keys, lock screen)', () => {
    const { onPlayerPause } = renderScreen();
    player.state = YT_PAUSED;
    player.props.onPause();
    expect(onPlayerPause).toHaveBeenCalledTimes(1);
  });
});

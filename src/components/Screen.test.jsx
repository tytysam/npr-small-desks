// @vitest-environment jsdom
import { render } from '@testing-library/react';
import Screen from './Screen';

// A stand-in for react-player: records the props Screen hands it and exposes
// a fake YouTube API player through the ref, with a settable state.
const player = vi.hoisted(() => ({ props: null, state: 1 }));
vi.mock('react-player', async () => {
  const { useImperativeHandle } = await import('react');
  const FakePlayer = ({ ref, ...props }) => {
    useImperativeHandle(ref, () => ({ api: { getPlayerState: () => player.state } }));
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

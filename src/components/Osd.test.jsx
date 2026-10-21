// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import Osd from './Osd';

const base = { flash: null, channelNumber: 7, live: false, artist: 'Mac Miller', volume: 0.45, brightness: 1 };

describe('Osd', () => {
  test('a channel change shows the number and artist', () => {
    render(<Osd {...base} flash="channel" />);
    expect(screen.getByText('CH 07')).toBeInTheDocument();
    expect(screen.getByText('Mac Miller')).toBeInTheDocument();
  });

  test('a live station carries a standing LIVE bug with the time', () => {
    const { container } = render(<Osd {...base} live />);
    const bug = container.querySelector('.osd-bug');
    expect(bug).toHaveClass('is-live');
    expect(bug.textContent).toMatch(/^LIVE \d{1,2}:\d{2}/);
  });

  test('VCR shows the tape counter instead, with the deck paused or playing', () => {
    const { container, rerender } = render(<Osd {...base} tapeSeconds={754} />);
    expect(container.querySelector('.osd-bug')).toHaveTextContent('▶ 0:12:34');
    rerender(<Osd {...base} tapeSeconds={754} paused />);
    expect(container.querySelector('.osd-bug')).toHaveTextContent('❚❚ 0:12:34');
  });

  test('no bug before a channel is tuned', () => {
    const { container } = render(<Osd {...base} channelNumber={null} live />);
    expect(container.querySelector('.osd-bug')).toBeNull();
  });

  test('switching modes announces the one now on', () => {
    const { rerender } = render(<Osd {...base} banner="mode" live />);
    expect(screen.getByText('LIVE TV')).toBeInTheDocument();
    rerender(<Osd {...base} banner="mode" />);
    expect(screen.getByText('VCR')).toBeInTheDocument();
    expect(screen.getByText('Playing from the top')).toBeInTheDocument();
    rerender(<Osd {...base} banner="rejoin" live />);
    expect(screen.getByText('Rejoining the broadcast')).toBeInTheDocument();
  });

  test('pausing a live station says play rejoins it; a tape just pauses', () => {
    const { rerender } = render(<Osd {...base} paused live />);
    expect(screen.getByText('PLAY REJOINS LIVE')).toBeInTheDocument();
    rerender(<Osd {...base} paused />);
    expect(screen.queryByText('PLAY REJOINS LIVE')).not.toBeInTheDocument();
  });

  test('no PLAY ▶ deck indicator while live', () => {
    render(<Osd {...base} live />);
    expect(screen.queryByText(/PLAY ▶/)).not.toBeInTheDocument();
  });

  test('a volume change shows a level bar', () => {
    const { container } = render(<Osd {...base} flash="volume" />);
    expect(screen.getByText('VOLUME')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(container.querySelectorAll('.osd-bar-segment.is-lit')).toHaveLength(9); // 45% of 20
  });

  test('standing indicators', () => {
    render(<Osd {...base} paused muted tuning />);
    expect(screen.getByText('❚❚ PAUSE')).toBeInTheDocument();
    expect(screen.getByText('MUTE')).toBeInTheDocument();
    expect(screen.getByText('TUNING')).toBeInTheDocument();
  });

  test('SCAN replaces TUNING while scanning', () => {
    render(<Osd {...base} tuning scanning />);
    expect(screen.getByText('SCAN')).toBeInTheDocument();
    expect(screen.queryByText('TUNING')).not.toBeInTheDocument();
  });

  test('the hint only shows when no panel is flashing', () => {
    const { rerender } = render(<Osd {...base} hint="Click anywhere for sound" />);
    expect(screen.getByText('Click anywhere for sound')).toBeInTheDocument();
    rerender(<Osd {...base} hint="Click anywhere for sound" flash="volume" />);
    expect(screen.queryByText('Click anywhere for sound')).not.toBeInTheDocument();
  });
});

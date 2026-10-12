// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import Osd from './Osd';

const base = { flash: null, channelNumber: 7, live: false, artist: 'Mac Miller', volume: 0.45, brightness: 1 };

describe('Osd', () => {
  test('a channel change shows the number and artist', () => {
    render(<Osd {...base} flash="channel" />);
    expect(screen.getByText('CH 07')).toBeInTheDocument();
    expect(screen.getByText('Mac Miller')).toBeInTheDocument();
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
  });

  test('broadcast stations are tagged LIVE', () => {
    render(<Osd {...base} flash="channel" live />);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
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

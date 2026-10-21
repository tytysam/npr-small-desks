// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TV from './TV';

vi.mock('../hooks/useWoodImages', () => ({ default: () => null }));
vi.mock('./Screen', () => ({ default: () => null }));

const renderTV = (props = {}) => {
  const onBroadcastToggle = vi.fn();
  render(
    <TV
      screen={{}}
      volume={0.5}
      onVolumeChange={() => {}}
      onChannelChange={() => {}}
      dialPosition={0}
      brightness={1}
      onBrightnessChange={() => {}}
      isOn
      onPowerToggle={() => {}}
      paused={false}
      onPauseToggle={() => {}}
      onMenuToggle={() => {}}
      antenna={{ angle: 0, wobble: 0 }}
      broadcast
      onBroadcastToggle={onBroadcastToggle}
      {...props}
    />
  );
  return { onBroadcastToggle };
};

describe('TV/VCR switch', () => {
  test('is on (and ON AIR lit) while live', () => {
    renderTV();
    expect(screen.getByRole('switch', { name: 'Live TV' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('On Air')).toHaveClass('is-on');
  });

  test('is off, with ON AIR dark, on the VCR', () => {
    renderTV({ broadcast: false });
    expect(screen.getByRole('switch', { name: 'Live TV' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('On Air')).not.toHaveClass('is-on');
  });

  test('flips the mode when clicked', async () => {
    const { onBroadcastToggle } = renderTV();
    await userEvent.click(screen.getByRole('switch', { name: 'Live TV' }));
    expect(onBroadcastToggle).toHaveBeenCalled();
  });
});

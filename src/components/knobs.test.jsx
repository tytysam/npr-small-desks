// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VolumeKnob from './VolumeKnob';
import BrightnessKnob from './BrightnessKnob';
import { BRIGHTNESS_MIN, BRIGHTNESS_MAX } from '../js/picture';

const SWEEP_DEG = 270;
const KEY_STEP = 13.5; // degrees per arrow key
const WHEEL_STEP = 9; // degrees per wheel notch

describe('VolumeKnob', () => {
  test('exposes the volume as a slider', () => {
    render(<VolumeKnob volume={0.5} onVolumeChange={() => {}} />);
    const knob = screen.getByRole('slider', { name: 'Volume' });
    expect(knob).toHaveAttribute('aria-valuenow', '50');
    expect(knob).toHaveStyle({ transform: 'rotate(0deg)' }); // half volume points straight up
  });

  test('arrow keys turn it up and down by a step', async () => {
    const onVolumeChange = vi.fn();
    render(<VolumeKnob volume={0.5} onVolumeChange={onVolumeChange} />);
    const knob = screen.getByRole('slider', { name: 'Volume' });
    knob.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(onVolumeChange).toHaveBeenLastCalledWith(0.5 + KEY_STEP / SWEEP_DEG);
    await userEvent.keyboard('{ArrowLeft}');
    expect(onVolumeChange).toHaveBeenLastCalledWith(0.5 - KEY_STEP / SWEEP_DEG);
  });

  test('each step starts from the latest volume', async () => {
    const onVolumeChange = vi.fn();
    const { rerender } = render(<VolumeKnob volume={0.5} onVolumeChange={onVolumeChange} />);
    const knob = screen.getByRole('slider', { name: 'Volume' });
    knob.focus();
    await userEvent.keyboard('{ArrowUp}');
    rerender(<VolumeKnob volume={0.8} onVolumeChange={onVolumeChange} />);
    await userEvent.keyboard('{ArrowUp}');
    expect(onVolumeChange).toHaveBeenLastCalledWith(0.8 + KEY_STEP / SWEEP_DEG);
  });

  test('stops at the ends without reporting a change', async () => {
    const onVolumeChange = vi.fn();
    render(<VolumeKnob volume={1} onVolumeChange={onVolumeChange} />);
    screen.getByRole('slider', { name: 'Volume' }).focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(onVolumeChange).not.toHaveBeenCalled();
  });

  test('the mouse wheel turns it', () => {
    const onVolumeChange = vi.fn();
    render(<VolumeKnob volume={0.5} onVolumeChange={onVolumeChange} />);
    fireEvent.wheel(screen.getByRole('slider', { name: 'Volume' }), { deltaY: 100 });
    expect(onVolumeChange).toHaveBeenLastCalledWith(0.5 + WHEEL_STEP / SWEEP_DEG);
  });
});

describe('BrightnessKnob', () => {
  const range = BRIGHTNESS_MAX - BRIGHTNESS_MIN;

  test('exposes the brightness as a slider', () => {
    render(<BrightnessKnob brightness={1} onBrightnessChange={() => {}} />);
    const knob = screen.getByRole('slider', { name: 'Brightness' });
    expect(knob).toHaveAttribute('aria-valuenow', '100');
    expect(knob).toHaveAttribute('aria-valuemin', String(BRIGHTNESS_MIN * 100));
    expect(knob).toHaveAttribute('aria-valuemax', String(BRIGHTNESS_MAX * 100));
  });

  test('steps from the latest brightness', async () => {
    const onBrightnessChange = vi.fn();
    const { rerender } = render(<BrightnessKnob brightness={1} onBrightnessChange={onBrightnessChange} />);
    screen.getByRole('slider', { name: 'Brightness' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onBrightnessChange).toHaveBeenLastCalledWith(1 - (KEY_STEP / SWEEP_DEG) * range);
    rerender(<BrightnessKnob brightness={1.2} onBrightnessChange={onBrightnessChange} />);
    await userEvent.keyboard('{ArrowUp}');
    expect(onBrightnessChange).toHaveBeenLastCalledWith(1.2 + (KEY_STEP / SWEEP_DEG) * range);
  });
});

// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScenePane from './ScenePane';
import { SCENE_DEFAULTS } from '../js/sceneSettings';

const renderPane = () => {
  const handlers = { onChange: vi.fn(), onView: vi.fn(), onClose: vi.fn() };
  render(<ScenePane scene={SCENE_DEFAULTS} {...handlers} />);
  return handlers;
};

describe('ScenePane', () => {
  test('opens with focus on its close button', () => {
    renderPane();
    expect(screen.getByRole('dialog', { name: 'Scene' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  test('shows the current choices and reports new ones', async () => {
    const { onChange } = renderPane();
    expect(screen.getByRole('radio', { name: 'Afternoon' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Lights out' }));
    expect(onChange).toHaveBeenCalledWith('mood', 'lightsOut');
    await userEvent.click(screen.getByRole('radio', { name: 'Morning' }));
    expect(onChange).toHaveBeenCalledWith('mood', 'morning');
  });

  test('view buttons ask for a view', async () => {
    const { onView } = renderPane();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onView).toHaveBeenCalledWith('back');
  });

  test('Esc closes it', async () => {
    const { onClose } = renderPane();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

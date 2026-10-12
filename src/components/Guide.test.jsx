// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuideBook } from './Guide';
import { makeSchedule } from '../js/schedule';

const ARTISTS = ['Anderson .Paak', 'Billie Eilish', 'Chika', 'Dua Lipa', 'Esperanza Spalding', 'Fred again..'];
const channels = Array.from({ length: 40 }, (_, i) => {
  const artist = i < ARTISTS.length ? ARTISTS[i] : `Artist ${i + 1}`;
  return { id: `video-${i}`, artist, title: `${artist}: Tiny Desk Concert`, publishedAt: '2024-01-01', duration: 900 };
});
channels[33] = { ...channels[33], artist: 'Zedd', title: 'Zedd: Tiny Desk (Home) Concert' };

// Reduced motion: the book opens, turns and closes without animating.
beforeEach(() => {
  window.matchMedia = (query) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  });
});

const renderGuide = (props = {}) => {
  const handlers = { onTune: vi.fn(), onPlayVideo: vi.fn(), onClose: vi.fn() };
  render(<GuideBook channels={channels} schedule={null} station={2} broadcast={false} origin={null} {...handlers} {...props} />);
  return handlers;
};
const row = (ch) => screen.getAllByRole('button').find((b) => b.querySelector('.guide-ch')?.textContent === String(ch));

describe('GuideBook', () => {
  test('opens as a dialog with the current channel marked', () => {
    renderGuide();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const current = row(3);
    expect(current).toHaveAttribute('aria-current', 'true');
    expect(within(current).getByText('You are here')).toBeInTheDocument();
    expect(within(current).getByText('Chika')).toBeInTheDocument();
    expect(row(24)).toBeDefined(); // a spread is two pages of 12
    expect(row(25)).toBeUndefined();
  });

  test('picking a listing tunes to it and closes the book', async () => {
    const { onTune, onClose } = renderGuide();
    await userEvent.click(row(5));
    expect(onTune).toHaveBeenCalledWith(4);
    expect(onClose).toHaveBeenCalled();
  });

  test('Esc closes it', async () => {
    const { onClose, onTune } = renderGuide();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    expect(onTune).not.toHaveBeenCalled();
  });

  test('the next page shows the following channels', async () => {
    renderGuide();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(row(25)).toBeDefined();
    expect(row(3)).toBeUndefined();
  });

  test('search finds an artist anywhere in the lineup', async () => {
    const { onTune } = renderGuide();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search listings' }), 'zedd');
    const hit = row(34);
    expect(within(hit).getByText('Zedd')).toBeInTheDocument();
    expect(row(3)).toBeUndefined();
    await userEvent.click(hit);
    expect(onTune).toHaveBeenCalledWith(33);
  });

  test('jumping to a channel turns to it and marks it', async () => {
    renderGuide();
    await userEvent.type(screen.getByRole('textbox', { name: 'Jump to channel' }), '38{Enter}');
    expect(row(38)).toHaveClass('is-marked');
  });

  test('live listings show what is on now and next', () => {
    renderGuide({ broadcast: true, schedule: makeSchedule(channels) });
    const current = row(3);
    expect(current.querySelectorAll('time')).toHaveLength(2); // start times for now and next
    expect(current.querySelector('.guide-progress')).not.toBeNull();
  });
});

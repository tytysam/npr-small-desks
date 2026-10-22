// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuideBook } from './Guide';
import { makeSchedule } from '../js/schedule';
import { SIGN_OFF } from '../js/channels';

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
  return { ...handlers, ...props };
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

  test('channel 0 tunes to the sign-off', async () => {
    const { onTune, onClose } = renderGuide();
    await userEvent.type(screen.getByRole('textbox', { name: 'Jump to channel' }), '0{Enter}');
    expect(onTune).toHaveBeenCalledWith(SIGN_OFF);
    expect(onClose).toHaveBeenCalled();
  });

  test('the right search lists the sign-off as channel 000', async () => {
    const { onTune } = renderGuide();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search listings' }), 'samuelson');
    expect(screen.queryByText(/No listings/)).not.toBeInTheDocument();
    await userEvent.click(row('000'));
    expect(onTune).toHaveBeenCalledWith(SIGN_OFF);
  });

  test('opens on the first page when tuned to the sign-off', () => {
    renderGuide({ station: SIGN_OFF });
    expect(row(1)).toBeDefined();
  });

  test('the 0 tab opens the colophon, and the next page leaves it for channel 1', async () => {
    renderGuide({ station: 30 });
    await userEvent.click(screen.getByRole('button', { name: '0' }));
    expect(screen.getByText('NPR Small Desk · built by Tyler Samuelson')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'The NP-R1, drawn in type' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '0' })).toHaveClass('is-active');
    expect(row(31)).toBeUndefined();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.queryByText('NPR Small Desk · built by Tyler Samuelson')).not.toBeInTheDocument();
    expect(row(1)).toBeDefined();
  });

  test('the last page shows the last thumb tab, however you page to it', async () => {
    // 110 channels: the last spread (97–110) straddles the "1" and "101" tabs.
    const lineup = Array.from({ length: 110 }, (_, i) => ({ ...channels[i % channels.length], id: `video-${i}` }));
    renderGuide({ channels: lineup, station: 0 });
    const active = () => screen.getAllByRole('button').find((b) => b.classList.contains('is-active'))?.textContent;
    await userEvent.click(screen.getByRole('button', { name: '101' }));
    expect(active()).toBe('101');
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(active()).toBe('1');
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(row(110)).toBeDefined();
    expect(active()).toBe('101');
  });

  test('a turning page carries its controls, inert', async () => {
    window.matchMedia = (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
    renderGuide();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    const copies = [...document.querySelectorAll('.guide-turn-leaf .guide-page')];
    expect(copies).toHaveLength(2);
    copies.forEach((copy) => expect(copy).toHaveAttribute('inert'));
    const controls = (label) => copies.flatMap((copy) => [...copy.querySelectorAll(`[aria-label="${label}"]`)]);
    expect(controls('Previous page')).toHaveLength(1);
    expect(controls('Next page')).toHaveLength(1);
    expect(controls('Close')).toHaveLength(1);
  });

  test('live listings show what is on now and next', () => {
    renderGuide({ broadcast: true, schedule: makeSchedule(channels) });
    const current = row(3);
    expect(current.querySelectorAll('time')).toHaveLength(2); // start times for now and next
    expect(current.querySelector('.guide-progress')).not.toBeNull();
  });

  test('the masthead shows which edition is open and switches between them', async () => {
    const { onBroadcastChange } = renderGuide({ onBroadcastChange: vi.fn() });
    const [onAir] = screen.getAllByRole('button', { name: 'On Air' });
    const [tapes] = screen.getAllByRole('button', { name: 'Tapes' });
    expect(tapes).toHaveAttribute('aria-pressed', 'true');
    expect(onAir).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(onAir);
    expect(onBroadcastChange).toHaveBeenCalledWith(true);
  });

  test('tapes list their running time where live listings show the hour', () => {
    renderGuide();
    expect(within(row(3)).getByText('15 min')).toBeInTheDocument(); // 900 s
  });
});


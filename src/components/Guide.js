import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import useDialog from '../hooks/useDialog';
import { findAiring } from '../js/schedule';
import { PER_PAGE, indexTabs, listingFor, searchChannels } from '../js/listings';
import './Guide.css';

const NARROW = '(max-width: 680px)';
const REFRESH_MS = 30000;
const SWIPE_PX = 50;
const MARQUEE_PX_PER_S = 40;
const MARQUEE_HOLD_S = 1.2; // pause at each end, split across the two ends
const MARQUEE_FADE_PX = 24; // the edge fade (Guide.css); glide far enough to clear it

const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dateline = (ms) => new Date(ms).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
const minutes = (seconds) => `${Math.max(1, Math.round(seconds / 60))} min`;
const year = (video) => video.publishedAt?.slice(0, 4) ?? '';
// "Artist: Tiny Desk (Home) Concert" → "Tiny Desk (Home) Concert"
const billing = (video) => {
  const rest = video.title.startsWith(`${video.artist}:`) ? video.title.slice(video.artist.length + 1).trim() : video.title;
  return rest || 'Tiny Desk Concert';
};

const useNarrow = () => {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);
  useEffect(() => {
    const query = window.matchMedia(NARROW);
    const onChange = () => setNarrow(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return narrow;
};

/**
 * Text that's clipped to its column. If it doesn't fit, it fades out at the
 * edge and glides across to show the rest while its row is hovered or focused
 * (see .guide-marquee in Guide.css).
 */
const Marquee = ({ children }) => {
  const boxRef = useRef(null);
  const textRef = useRef(null);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const measure = () => {
      const overflow = textRef.current.scrollWidth - box.clientWidth;
      setShift(overflow > 0 ? overflow + MARQUEE_FADE_PX : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [children]);

  const style = shift
    ? { '--marquee-shift': `${-shift}px`, '--marquee-time': `${(shift / MARQUEE_PX_PER_S + MARQUEE_HOLD_S).toFixed(2)}s` }
    : undefined;
  return (
    <span ref={boxRef} className={`guide-marquee${shift ? ' is-overflowing' : ''}`} style={style} title={shift ? children : undefined}>
      <span ref={textRef} className="guide-marquee-text">
        {children}
      </span>
    </span>
  );
};

/** One line of listings: the channel number in a block, then two lines of type. */
const Row = ({ ch, titleTime, title, detailTime, detail, progress, current, marked, onClick, rowRef }) => (
  <li>
    <button
      ref={rowRef}
      type="button"
      className={`guide-row${current ? ' is-current' : ''}${marked ? ' is-marked' : ''}`}
      aria-current={current ? 'true' : undefined}
      onClick={onClick}
    >
      <span className="guide-ch">{ch}</span>
      <span className="guide-slot">
        <span className="guide-line guide-title">
          {titleTime && <time>{titleTime}</time>}
          <Marquee>{title}</Marquee>
        </span>
        <span className="guide-line guide-detail">
          {detailTime && <time>{detailTime}</time>}
          <Marquee>{detail}</Marquee>
        </span>
        {progress !== undefined && (
          <span className="guide-progress" aria-hidden="true">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
        )}
      </span>
      {current && <span className="guide-here">You are here</span>}
    </button>
  </li>
);

/**
 * The TV guide: a listings digest opened to a two-page spread (one page on
 * small screens). Live, each station shows what's on now and next with
 * times; in VCR mode, each station's one concert. Search turns the pages
 * into matching concerts, with where (and when) to catch each one.
 *
 * Picking a listing calls `onTune(station)`, or `onPlayVideo(index)` to play
 * a concert from the top when no station is showing it right now.
 */
export const GuideBook = ({ channels, schedule, station, broadcast, onTune, onPlayVideo, onClose }) => {
  const bookRef = useRef(null);
  const searchRef = useRef(null);
  const currentRowRef = useRef(null);
  const markedRowRef = useRef(null);
  const swipeRef = useRef(null);
  const narrow = useNarrow();
  const perSpread = narrow ? PER_PAGE : PER_PAGE * 2;

  const [query, setQuery] = useState('');
  const [start, setStart] = useState(station ?? 0); // any entry on the spread to show
  const [marked, setMarked] = useState(null);
  const [jump, setJump] = useState('');
  const [now, setNow] = useState(Date.now);

  useDialog(bookRef, { onClose, initialFocusRef: currentRowRef });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    markedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [marked]);

  const hits = useMemo(() => (query.trim() ? searchChannels(channels, query) : null), [channels, query]);
  const total = hits ? hits.length : channels.length;
  const lastFirst = Math.max(0, Math.floor((total - 1) / perSpread) * perSpread);
  const first = Math.min(Math.floor(start / perSpread) * perSpread, lastFirst);
  const entries = Array.from({ length: Math.max(0, Math.min(perSpread, total - first)) }, (_, k) =>
    hits ? hits[first + k] : first + k
  );
  const pages = narrow ? [entries] : [entries.slice(0, PER_PAGE), entries.slice(PER_PAGE)];
  const tabs = useMemo(() => indexTabs(channels.length), [channels.length]);

  const turn = useCallback(
    (direction) => {
      const next = first + direction * perSpread;
      if (next < 0 || next > lastFirst) return;
      setStart(next);
      setMarked(null);
    },
    [first, perSpread, lastFirst]
  );

  const search = (value) => {
    setQuery(value);
    setStart(0);
    setMarked(null);
  };

  const goTo = (index) => {
    setQuery('');
    setStart(index);
    setMarked(index);
  };

  const submitJump = (e) => {
    e.preventDefault();
    const n = Number.parseInt(jump, 10);
    if (n >= 1 && n <= channels.length) goTo(n - 1);
  };

  const onKeyDown = (e) => {
    const typing = e.target instanceof HTMLInputElement;
    if (e.key === '/' && !typing) {
      e.preventDefault();
      searchRef.current?.focus();
    } else if (!typing && (e.key === 'ArrowLeft' || e.key === 'PageUp')) {
      e.preventDefault();
      turn(-1);
    } else if (!typing && (e.key === 'ArrowRight' || e.key === 'PageDown')) {
      e.preventDefault();
      turn(1);
    }
  };

  const onPointerDown = (e) => {
    swipeRef.current = e.pointerType === 'touch' ? e.clientX : null;
  };
  const onPointerUp = (e) => {
    if (swipeRef.current === null) return;
    const dx = e.clientX - swipeRef.current;
    swipeRef.current = null;
    if (Math.abs(dx) > SWIPE_PX) turn(dx < 0 ? 1 : -1);
  };

  const stationRow = (s) => {
    const props = {
      current: s === station,
      marked: s === marked,
      rowRef: s === station ? currentRowRef : s === marked ? markedRowRef : undefined,
      ch: s + 1,
      onClick: () => onTune(s),
    };
    if (!broadcast || !schedule) {
      const video = channels[s];
      return <Row key={s} {...props} title={video.artist} detail={`${billing(video)} · ${year(video)} · ${minutes(video.duration)}`} />;
    }
    const { now: on, next } = listingFor(schedule, s, now, true);
    return (
      <Row
        key={s}
        {...props}
        progress={on.progress}
        titleTime={clock(on.startMs)}
        title={channels[on.index].artist}
        detailTime={clock(next.startMs)}
        detail={channels[next.index].artist}
      />
    );
  };

  const searchRow = (i) => {
    const video = channels[i];
    const title = video.artist;
    if (!broadcast || !schedule) {
      return <Row key={i} ch={i + 1} current={i === station} title={title} detail={`${billing(video)} · ${year(video)}`} onClick={() => onTune(i)} />;
    }
    const airing = findAiring(schedule, i, now);
    if (airing.onNow) {
      return (
        <Row
          key={i}
          ch={airing.station + 1}
          current={airing.station === station}
          title={title}
          detail={`On now · ${minutes(airing.offset)} in · ${year(video)}`}
          progress={airing.offset / video.duration}
          onClick={() => onTune(airing.station)}
        />
      );
    }
    return (
      <Row
        key={i}
        ch="▶"
        title={title}
        detail={`Airs ${clock(now + airing.startsIn * 1000)} on ch ${airing.station + 1} · play it now`}
        onClick={() => onPlayVideo(i)}
      />
    );
  };

  // Turning a page unmounts the focused row; keep focus in the book.
  useEffect(() => {
    if (!bookRef.current?.contains(document.activeElement)) bookRef.current?.focus();
  }, [first, hits]);

  const pageNumber = first / PER_PAGE + 1;
  // The tab for the channel asked for, or else for the top of the spread.
  const shown = start >= first && start < first + perSpread ? start : first;
  const activeTab = hits ? null : Math.floor(shown / 100);

  return (
    <div className="guide-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={bookRef}
        className="guide-book"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="guide-head">
          <h2 id="guide-title" className="guide-masthead">
            <span className="guide-brand">NP-R1</span> Listings
          </h2>
          <p className="guide-dateline">
            {dateline(now)} · {broadcast ? `Live · ${clock(now)}` : 'VCR'}
          </p>
          <div className="guide-tools">
            <input
              ref={searchRef}
              className="guide-search"
              type="search"
              placeholder="Find an artist…"
              aria-label="Search listings"
              value={query}
              onChange={(e) => search(e.target.value)}
            />
            <form className="guide-jump" onSubmit={submitJump}>
              <label>
                CH
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  aria-label="Jump to channel"
                  value={jump}
                  onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && submitJump(e)}
                />
              </label>
            </form>
          </div>
          <button type="button" className="guide-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="guide-body">
          <div className="guide-spread" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
            {total === 0 ? (
              <p className="guide-empty">No listings for “{query.trim()}”.</p>
            ) : (
              pages.map((page, p) => (
                <section key={p} className="guide-page" aria-label={`Page ${pageNumber + p}`}>
                  <ol className="guide-rows">{page.map(hits ? searchRow : stationRow)}</ol>
                </section>
              ))
            )}
            <div className="guide-cover" aria-hidden="true">
              <span className="guide-cover-brand">NP-R1</span>
              <span className="guide-cover-title">Listings</span>
              <span className="guide-cover-sub">Tiny Desk Weekly</span>
            </div>
          </div>

          {!hits && (
            <nav className="guide-tabs" aria-label="Channels by hundred">
              {tabs.map((tab, t) => (
                <button
                  key={tab.label}
                  type="button"
                  className={`guide-tab${t === activeTab ? ' is-active' : ''}`}
                  onClick={() => {
                    setStart(tab.index);
                    setMarked(null);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          )}
        </div>

        <footer className="guide-foot">
          <button type="button" className="guide-turn" aria-label="Previous page" disabled={first === 0} onClick={() => turn(-1)}>
            ‹
          </button>
          <span className="guide-folio">
            {hits
              ? `${total} ${total === 1 ? 'concert' : 'concerts'} · p. ${pageNumber}`
              : `Channels ${first + 1}–${first + entries.length} · p. ${pageNumber}`}
          </span>
          <button type="button" className="guide-turn" aria-label="Next page" disabled={first >= lastFirst} onClick={() => turn(1)}>
            ›
          </button>
        </footer>
      </div>
    </div>
  );
};

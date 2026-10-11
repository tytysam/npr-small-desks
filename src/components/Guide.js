import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import useDialog from '../hooks/useDialog';
import { findAiring } from '../js/schedule';
import { PER_PAGE, indexTabs, listingFor, searchChannels } from '../js/listings';
import './Guide.css';

const NARROW = '(max-width: 680px)';
const REFRESH_MS = 30000;
const SWIPE_PX = 50;
const TURN_MS = 420; // keep in step with --turn-ms in Guide.css
const CLOSE_MS = 420; // the fold shut, then the shrink back to the set (Guide.css)
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

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

/** The front cover: what you see on the closed book. */
const Cover = () => (
  <div className="guide-cover" aria-hidden="true">
    <span className="guide-cover-brand">NP-R1</span>
    <span className="guide-cover-title">Listings</span>
    <span className="guide-cover-photo" />
    <span className="guide-cover-sub">Tiny Desk Weekly</span>
  </div>
);

/**
 * The TV guide: a listings digest that grows out of the stack on the set
 * (`origin`, the stack's centre and width on screen) and opens to a two-page
 * spread (one page on small screens). Live, each station shows what's on now
 * and next with times; in VCR mode, each station's one concert. Search turns
 * the pages into matching concerts, with where (and when) to catch each one.
 *
 * It's built like a book: on a spread, the left page is the back of the
 * front cover, which swings open around the spine; page turns flip a leaf
 * whose two sides are the pages it carries. Closing folds it shut and
 * shrinks it back to the set before `onClose`.
 *
 * Picking a listing calls `onTune(station)`, or `onPlayVideo(index)` to play
 * a concert from the top when no station is showing it right now.
 */
export const GuideBook = ({ channels, schedule, station, broadcast, origin, onTune, onPlayVideo, onClose }) => {
  const bookRef = useRef(null);
  const spreadRef = useRef(null);
  const searchRef = useRef(null);
  const currentRowRef = useRef(null);
  const markedRowRef = useRef(null);
  const swipeRef = useRef(null);
  const closingRef = useRef(false);
  const turnTimerRef = useRef(null);
  const narrow = useNarrow();
  const perSpread = narrow ? PER_PAGE : PER_PAGE * 2;

  const [query, setQuery] = useState('');
  const [start, setStart] = useState(station ?? 0); // any entry on the spread to show
  const [marked, setMarked] = useState(null);
  const [jump, setJump] = useState('');
  const [now, setNow] = useState(Date.now);
  const [phase, setPhase] = useState('closed'); // 'closed' → 'open' → 'closing'
  const [from, setFrom] = useState(null); // where the closed book starts: CSS vars
  const [turning, setTurning] = useState(null); // { dir, from }: a page turn in progress

  // --- opening and closing ---------------------------------------------------
  // Place the closed book over the stack on the set (measured before the
  // first paint), then open it on the next frame.
  useLayoutEffect(() => {
    const book = bookRef.current.getBoundingClientRect();
    const spread = spreadRef.current.getBoundingClientRect();
    const cx = spread.left + spread.width / 2; // the closed book is centred here
    const cy = spread.top + spread.height / 2;
    const closedWidth = narrow ? spread.width : spread.width / 2;
    const at = origin ?? { x: cx, y: cy + 24, width: closedWidth * 0.94 };
    setFrom({
      '--from-x': `${at.x - cx}px`,
      '--from-y': `${at.y - cy}px`,
      '--from-s': Math.min(1, Math.max(0.08, at.width / closedWidth)).toFixed(3),
      transformOrigin: `${cx - book.left}px ${cy - book.top}px`,
    });
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!from) return undefined;
    if (reducedMotion()) {
      setPhase('open');
      return undefined;
    }
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => setPhase('open'));
    });
    return () => cancelAnimationFrame(id);
  }, [from]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (reducedMotion()) {
      onClose();
      return;
    }
    setPhase('closing');
    setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useDialog(bookRef, { onClose: requestClose, initialFocusRef: currentRowRef });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => {
      clearInterval(id);
      clearTimeout(turnTimerRef.current);
    };
  }, []);

  useEffect(() => {
    markedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [marked]);


  // --- what's on which page ----------------------------------------------------
  const hits = useMemo(() => (query.trim() ? searchChannels(channels, query) : null), [channels, query]);
  const total = hits ? hits.length : channels.length;
  const lastFirst = Math.max(0, Math.floor((total - 1) / perSpread) * perSpread);
  const first = Math.min(Math.floor(start / perSpread) * perSpread, lastFirst);
  const firstPage = first / PER_PAGE;
  const tabs = useMemo(() => indexTabs(channels.length), [channels.length]);
  const entriesOn = (page) => {
    const count = Math.max(0, Math.min(PER_PAGE, total - page * PER_PAGE));
    return Array.from({ length: count }, (_, k) => (hits ? hits[page * PER_PAGE + k] : page * PER_PAGE + k));
  };

  // --- page turns ---------------------------------------------------------------
  const settle = () => {
    clearTimeout(turnTimerRef.current);
    setTurning(null);
  };

  const turn = useCallback(
    (direction) => {
      const next = first + direction * perSpread;
      if (next < 0 || next > lastFirst) return;
      setStart(next);
      setMarked(null);
      // A turn cuts short any turn still in progress, so quick presses keep up.
      clearTimeout(turnTimerRef.current);
      if (reducedMotion()) return;
      setTurning({ dir: direction, from: first });
      turnTimerRef.current = setTimeout(() => setTurning(null), TURN_MS);
    },
    [first, perSpread, lastFirst]
  );

  const search = (value) => {
    settle();
    setQuery(value);
    setStart(0);
    setMarked(null);
  };

  const goTo = (index) => {
    settle();
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

  // Turning a page unmounts the focused row; keep focus in the book.
  useEffect(() => {
    if (!bookRef.current?.contains(document.activeElement)) bookRef.current?.focus();
  }, [first, hits, turning]);

  // Picking a listing tunes straight away; the book folds shut over it.
  const pick = (tune) => () => {
    tune();
    requestClose();
  };

  // --- rows ------------------------------------------------------------------------
  const stationRow = (s, live) => {
    const props = {
      current: s === station,
      marked: s === marked,
      rowRef: !live ? undefined : s === station ? currentRowRef : s === marked ? markedRowRef : undefined,
      ch: s + 1,
      onClick: pick(() => onTune(s)),
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
      return (
        <Row key={i} ch={i + 1} current={i === station} title={title} detail={`${billing(video)} · ${year(video)}`} onClick={pick(() => onTune(i))} />
      );
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
          onClick={pick(() => onTune(airing.station))}
        />
      );
    }
    return (
      <Row
        key={i}
        ch="▶"
        title={title}
        detail={`Airs ${clock(now + airing.startsIn * 1000)} on ch ${airing.station + 1} · play it now`}
        onClick={pick(() => onPlayVideo(i))}
      />
    );
  };

  // --- pages -----------------------------------------------------------------------
  // `side` is 'left' / 'right' on a spread or 'single'. Live pages are
  // interactive; copies (the faces of a turning leaf) are print only.
  const summary = hits
    ? `${total} ${total === 1 ? 'concert' : 'concerts'}`
    : `Channels ${first + 1}–${Math.min(first + perSpread, total)}`;

  const masthead = (live) => (
    <>
      <h2 id={live ? 'guide-title' : undefined} className="guide-masthead">
        <span className="guide-brand">NP-R1</span> Listings
      </h2>
      <p className="guide-dateline">
        {dateline(now)} · {broadcast ? `Live · ${clock(now)}` : 'VCR'}
      </p>
    </>
  );

  const tools = (live) => (
    <div className="guide-tools">
      <input
        ref={live ? searchRef : undefined}
        className="guide-search"
        type="search"
        placeholder="Find an artist…"
        aria-label="Search listings"
        value={query}
        readOnly={!live}
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
            readOnly={!live}
            onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && submitJump(e)}
          />
        </label>
      </form>
    </div>
  );

  const closeButton = (
    <button type="button" className="guide-close" aria-label="Close" onClick={requestClose}>
      ✕
    </button>
  );

  const tabStrip = !hits && (
    <nav className="guide-tabs" aria-label="Channels by hundred">
      {tabs.map((tab, t) => {
        // The tab for the channel asked for, or else for the top of the spread.
        const shown = start >= first && start < first + perSpread ? start : first;
        return (
          <button
            key={tab.label}
            type="button"
            className={`guide-tab${t === Math.floor(shown / 100) ? ' is-active' : ''}`}
            onClick={() => {
              settle();
              setStart(tab.index);
              setMarked(null);
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );

  const prevButton = (
    <button type="button" className="guide-turn" aria-label="Previous page" disabled={first === 0} onClick={() => turn(-1)}>
      ‹
    </button>
  );
  const nextButton = (
    <button type="button" className="guide-turn" aria-label="Next page" disabled={first >= lastFirst} onClick={() => turn(1)}>
      ›
    </button>
  );

  const page = (side, number, live = true) => {
    const entries = entriesOn(number);
    return (
      <section
        key={`${side}-${live ? 'live' : 'copy'}`}
        className={`guide-page guide-page-${side}`}
        aria-label={live ? `Page ${number + 1}` : undefined}
        aria-hidden={live ? undefined : 'true'}
        inert={live ? undefined : ''}
      >
        <header className="guide-head">
          {side !== 'right' && masthead(live)}
          {side !== 'left' && tools(live)}
          {side !== 'left' && live && closeButton}
          {side === 'single' && live && tabStrip}
        </header>
        {total === 0 && number === 0 ? (
          <p className="guide-empty">No listings for “{query.trim()}”.</p>
        ) : (
          <ol className="guide-rows">{entries.map((entry) => (hits ? searchRow(entry) : stationRow(entry, live)))}</ol>
        )}
        <footer className="guide-foot">
          {side !== 'right' && (live ? prevButton : <span className="guide-turn-spacer" />)}
          <span className="guide-folio">
            {side === 'left' ? `p. ${number + 1}` : `${summary} · p. ${number + 1}`}
          </span>
          {side !== 'left' && (live ? nextButton : <span className="guide-turn-spacer" />)}
        </footer>
      </section>
    );
  };

  // Which pages lie open while a leaf is turning over them.
  let leftPage = firstPage;
  let rightPage = firstPage + 1;
  let singlePage = firstPage;
  let leaf = null;
  if (turning) {
    const fromPage = turning.from / PER_PAGE;
    const forward = turning.dir > 0;
    if (narrow) {
      // Forward: the old page swings away. Back: the new page swings in.
      singlePage = forward ? firstPage : fromPage;
      leaf = (
        <div key={`${turning.from}-${first}`} className={`guide-turn-leaf ${forward ? 'is-forward' : 'is-back'}`}>
          <div className="guide-face">{page('single', forward ? fromPage : firstPage, false)}</div>
        </div>
      );
    } else if (forward) {
      // The old right page turns over to become the new left page.
      leftPage = fromPage;
      leaf = (
        <div key={`${turning.from}-${first}`} className="guide-turn-leaf is-forward">
          <div className="guide-face">{page('right', fromPage + 1, false)}</div>
          <div className="guide-face guide-face-back">{page('left', firstPage, false)}</div>
        </div>
      );
    } else {
      rightPage = fromPage + 1;
      leaf = (
        <div key={`${turning.from}-${first}`} className="guide-turn-leaf is-back">
          <div className="guide-face">{page('left', fromPage, false)}</div>
          <div className="guide-face guide-face-back">{page('right', firstPage + 1, false)}</div>
        </div>
      );
    }
  }

  const phaseClass = phase === 'open' ? 'is-open' : `is-closed${phase === 'closing' ? ' is-closing' : ''}`;

  return (
    <div className={`guide-backdrop ${phaseClass}`} onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div
        ref={bookRef}
        className={`guide-book ${phaseClass} ${narrow ? 'is-narrow' : 'is-wide'}`}
        style={from ?? undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div ref={spreadRef} className="guide-spread" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
          {narrow ? (
            <>
              {page('single', singlePage)}
              {/* the front cover, swinging away to the left */}
              <div className="guide-cover-leaf">
                <div className="guide-face">
                  <Cover />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="guide-page-slot" />
              {page('right', rightPage)}
              {/* the front cover; its inside is the left page */}
              <div className="guide-cover-leaf">
                <div className="guide-face">{page('left', leftPage)}</div>
                <div className="guide-face guide-face-back">
                  <Cover />
                </div>
              </div>
              {tabStrip}
            </>
          )}
          {leaf}
        </div>
      </div>
    </div>
  );
};

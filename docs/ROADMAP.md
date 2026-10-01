# Roadmap

What's worth doing next on the small-desk TV, in three groups. Items move from
**Planned** → **Done** as they land; each notes where the work lives.

Order agreed: performance → functional additions → (after review) broadcast
mode and the CRT settings menu.

---

## 1. Performance

### 1.1 Build-time channel list — **Done**
**Problem.** Every page load called YouTube's `search.list`, which costs 100
of the default 10,000 daily quota units — roughly 100 visits a day before
every viewer sees NO SIGNAL. The key was shipped in the client bundle
(`REACT_APP_*` variables are public), and a search for "tiny desk" only
returned 50 loosely-matched results.

**Change.** `scripts/fetch-channels.mjs` walks NPR Music's uploads playlist
(`playlistItems.list`, 1 unit per 50 videos), keeps embeddable Tiny Desk
videos, looks up their durations (`videos.list`, 1 unit per 50), and writes
`public/channels.json`. The app fetches that static file; no API key reaches
the browser. Durations are included so broadcast mode (3.1) can be scheduled
without another API change.

- Runs automatically before `npm run build` (`prebuild`); `npm run channels`
  refreshes it on demand.
- The key is read from `YOUTUBE_API_KEY` (preferred) or the legacy
  `REACT_APP_YOUTUBE_API_KEY` in `.env`. Without a key the script keeps the
  existing `channels.json`, so builds still work — commit the file.
- Result: 1,906 playable concerts back to 2009 (was 50), ~60 KB gzipped,
  and the key no longer appears anywhere in the build output.
- **Manual follow-up:** rename the `.env` variable to `YOUTUBE_API_KEY`. Any
  build deployed before this change shipped the key to browsers, so treat it
  as public: restrict it to the YouTube Data API in Google Cloud, or rotate it.

### 1.2 Render the 3D scene on demand — **Done**
**Problem.** The scene is static unless you orbit or turn a knob, but R3F
redrew it every frame, and `ContactShadows` re-rendered its depth pass every
frame too.

**Change.** `frameloop="demand"` on the Canvas (R3F redraws when props change
or controls invalidate) and `ContactShadows frames={1}`.
`src/components/tv3d/TV3D.js`.

- Measured: an idle 3D set now requests 0 frames in 3 s (was ~180). Orbiting
  renders normally and stops ~1.3 s after release, once damping settles.

### 1.3 Prefetch the 3D chunk — **Done**
The three.js chunk (~250 KB gzipped) starts downloading when the pointer
hovers or keyboard-focuses the 2D/3D toggle, so switching is near-instant.
`src/App.js`, `src/components/ModeToggle.js`.

### 1.4 Free GPU textures that are replaced — **Done**
Switching 2D↔3D already releases everything: R3F force-loses the WebGL
context when the Canvas unmounts. The real leak was within a session — each
channel change built a new tuning-strip texture and never disposed the old
one. Hand-built textures, materials and geometries are now disposed when
replaced or unmounted (`useDisposable` in `src/components/tv3d/useDisposable.js`).

### 1.5 Drop axios — **Done**
Its only use was the YouTube request; `fetch` covers loading
`channels.json` (main bundle 72.4 → 61.0 KB gzipped).

### Considered, not worth it yet
- **Wood textures in a worker.** Generation is ~165 ms once, on first 3D
  mount, and is hidden by the CRT power-off transition.

---

## 2. Functional additions

### 2.1 Clean titles — **Done**
Titles arrive HTML-escaped (`&#39;WEIRD AL&#39;`). Decoded once in the
channel script, along with artist-name parsing.

### 2.2 On-screen display — **Done**
A phosphor-green OSD inside the tube, shared by both sets: channel number and
artist on channel change, a segmented bar for volume and brightness, and
persistent PAUSE / MUTE indicators. `src/components/Osd.js`.

### 2.3 Working controls — **Done**
- **Power:** the chrome slide switch turns the set off and on, with the CRT
  collapse/warm-up played inside the tube. Playback pauses while off, and
  power-cycling retries a failed channel load.
- **Brightness:** the small black knob on the rail adjusts picture
  brightness.

The channel dial's position now lives in the app, so both sets (and the
keyboard) turn the same dial.

### 2.4 Keyboard shortcuts — **Done**
| Key | Action |
|---|---|
| ↑ / ↓ | Channel up / down |
| ← / → | Volume down / up |
| M | Mute / unmute |
| Space | Pause / play |
| P | Power |

Ignored while a knob or button has focus, since those handle their own keys.

### 2.5 Persistence and share links — **Done**
Volume, brightness and the last channel are remembered. The address bar
tracks the current video (`?v=<id>`), so a link opens on the same concert.
Priority on load: `?v=` → last channel → random.

Browsers block autoplay with sound, so the set still starts muted; the first
click or key press anywhere restores the remembered volume, and the OSD says
so.

### 2.6 Better error state — **Done**
NO SIGNAL now retries on its own with backoff (3 s, 10 s, 30 s, 60 s), and
power-cycling the set retries immediately.

### 2.7 Review follow-ups — **Done**
- **Clean picture.** YouTube's own UI is gone: the player fills the 4:3 tube
  (the 16:9 frame's sides crop off), a shield keeps the pointer from
  summoning its hover overlay, captions are switched off whenever YouTube
  loads them, and static covers the tube until each video actually plays.
  Unplayable videos are skipped. `src/components/Screen.js`.
  - YouTube also overlays its title bar for the first few seconds of every
    video, at a fixed pixel size. The player now renders at 1280×720 and is
    scaled into the tube, so that band is a constant ~8% of the frame, and
    the top 9% sits above the glass (CRT-style overscan). Side effect: 3D
    gets a 720p picture instead of 360p.
  - Known leftover: for ~3 s after each tune-in YouTube still shows a small
    pause glyph mid-picture and a tiny "More videos" pill bottom-right. Both
    are inside its iframe, out of reach.
- **Play/pause lever.** A chrome bat-handle toggle on the rail of both sets:
  up plays, down pauses. It shares state with Space and the PAUSE indicator,
  and flipping it while the set is off decides whether it resumes on power-up.
- **Steady level readout.** The OSD number has a fixed three-digit slot, so
  the volume/brightness bar no longer shifts going from 99 to 100.

---

## 3. New features

### 3.1 Broadcast mode — **Done**
Each station runs the whole lineup back to back on a loop, starting from a
different point (station k began with video k at 2026-01-01 UTC). What's on
air is a pure function of the wall clock, so everyone tuned to the same
station sees the same moment — shared TV without a server.

- The OSD tags live stations **LIVE**; links share the station (`?ch=700`),
  and anyone opening one joins it mid-programme.
- Live TV doesn't wait: resuming from pause, powering on, or switching
  2D/3D rejoins the schedule *now*. A programme that ends hands straight to
  the next one on the schedule.
- **VCR** (in SETUP) is the old behaviour: station k plays video k from the
  start, and links share the video (`?v=`). A `?v=` link opened in Live mode
  plays that concert once, then channel changes return to live stations.
- The start offset rides in the YouTube URL (`&t=`), so the player opens at
  the right moment instead of seeking after it starts.
- `src/js/schedule.js` (unit-tested), `src/hooks/useTuner.js`.

### 3.2 CRT settings menu — **Done**
A SETUP menu drawn inside the tube in the OSD's phosphor style, opened with
the chrome knob on the rail (now **MENU**) or **O**, closed with MENU, O or
Esc. It's driven by the set's own controls, so it works identically in 2D and
3D: the channel control (dial or ↑/↓) picks a row, the volume control (knob
or ←/→) changes it.

| Setting | Effect |
|---|---|
| Broadcast | Live / VCR (see 3.1) |
| Scanlines | 0–10 scanline strength |
| Curvature | 0–10 edge fall-off and corner darkening |
| Warm-up | On: a slow ~2 s power-on bloom; off: near-instant |
| Degauss | Colour shiver as each new picture locks in |
| VHS | Tape jitter, colour bleed, a rolling tracking band, and PLAY ▶ |
| Hiss | Tuning hiss (3.3) |

Settings persist. `src/js/crtSettings.js` (unit-tested),
`src/components/Osd.js` (`SetupMenu`), `src/components/Screen.css`.

### 3.3 Antenna retune (random channel) — **Done**
With ~1,900 channels, stepping the dial only ever shows a sliver of the
lineup. Moving the antenna retunes to a random channel, like chasing
reception on an analog set.

- **Gesture.** Drag the antenna (swing it on its ball mount in 3D, pivot
  the rod in 2D), tap it on touch screens (it wobbles), or press **R**.
- **While it moves:** the picture drops out in steps (static, rolling
  vertical hold, ghosting), the video's audio ducks under a synthesized
  hiss (Web Audio noise; follows volume/mute, no assets).
- **On release:** about a second of "finding a station," then it locks onto
  a random channel and the OSD shows the jump (`CH 0712 · ARTIST`). The
  dial and ↑/↓ carry on from there.
- **Picking.** A shuffle bag: no repeats until most of the lineup has come
  up, and never the channel you just left.
- **LAST.** A recall control (Backspace / L) returns to the previous
  channel, since a stray bump shouldn't lose a concert you liked.
- **Why not map antenna angle to channel?** 1,900 channels over ~120° of
  swing is ~0.06° per channel: unsteerable, so it would feel random anyway.
- **With broadcast mode (3.1)** a retune lands mid-programme on that
  channel's schedule, which is what flipping around on a real set felt like.

- **Built as:** `useRetune` (reception state machine), `useAntennaGesture`
  (drag / tap / hold, shared by the DOM and three.js antennas), the shuffle
  bag in `src/js/shuffleBag.js` (unit-tested) and the Web Audio hiss in
  `src/js/hiss.js`. Keys: **R** retune, **S** scan, **L** / Backspace last.
- Picture: static, a rolling picture with a blanking bar, and jitter.
  Ghosting (a doubled image) isn't possible on a cross-origin iframe.

Also in scope (agreed, done):
- **Hiss on by default**, following the set's volume and mute.
- **SCAN.** Hold the antenna or press S to hop to a new random channel every
  few seconds until released.
- **Signal sweet spot.** While dragging, static eases in and out as the
  antenna passes hidden "good" angles, so it feels like hunting for reception.

### Later ideas
- **Watch-together.** Live viewer counts and shared channel changes over a
  realtime service (PartyKit, Liveblocks, Supabase Realtime). Layer on top of
  broadcast mode; the hard parts are iframe sync and autoplay policy.
- **Themed channels.** Map the 12 dial positions to curated lists (jazz,
  hip-hop, indie, home concerts, by year).
- **More set styles.** 1950s Bakelite, 1980s silver portable, Trinitron.
  The 2D tokens (`TV.css`) and 3D palette (`tv3d/materials.js`) keep this
  mostly declarative.
- **A "small desk" room.** The 3D set on a desk with a lamp, tinted by the
  current video's thumbnail colour (the iframe itself can't be sampled).

# NPR Small Desk

A mid-century television, the **NP-R1**, that tunes through every NPR Music
Tiny Desk concert on YouTube (about 1,900 of them). The same set is built
twice: a **2D** version in HTML/CSS and a **3D** version in three.js, with a
CRT power-down between the two.

Every channel is "on the air": each one plays the lineup on a schedule set by
the clock, so anyone tuned to the same channel sees the same moment, with no
server involved. Flip the dial, wiggle the antenna for a random station, or
look one up in the TV guide on top of the set.

What's been done and what might come next is in
[docs/ROADMAP.md](docs/ROADMAP.md).

## Getting started

Requires Node 18 or later.

```sh
npm install
npm start          # http://localhost:3000
```

The channel lineup (`public/channels.json`) is committed, so the app runs
without a YouTube API key. A key is only needed to refresh the lineup; see
[Channel data](#channel-data).

| Script | What it does |
|---|---|
| `npm start` | Development server |
| `npm test` | Unit tests (Jest) |
| `npm run build` | Production build in `build/`; refreshes the lineup first if a key is set |
| `npm run channels` | Refresh `public/channels.json` (see below) |

## Using the set

### On the set

| Control | Does |
|---|---|
| Channel dial (top knob) | Channel up / down |
| Volume knob | Volume. The set starts muted; click anywhere for sound |
| Antenna | Drag to hunt for a random station, tap to retune, press and hold to scan |
| Slide switch | Power |
| Lever on the rail | Play / pause |
| Small black knob | Brightness |
| Chrome button by the NP-R1 badge | MENU: opens the SETUP menu |
| Book stack on top | The TV guide |
| "?" (top right) | A short owner's manual |
| 2D / 3D switch (top right) | Swap sets. In 3D, drag to look around |

### Keyboard

| Key | Action |
|---|---|
| ↑ / ↓ | Channel up / down (in SETUP: select a row) |
| ← / → | Volume down / up (in SETUP: change the row) |
| M | Mute / unmute |
| Space | Pause / play |
| P | Power |
| R | Retune the antenna (random channel) |
| S | Scan: hop to a random channel every few seconds |
| L / Backspace | Last channel |
| O / Esc | Open / close SETUP |
| G | Open the TV guide |
| ? | Owner's manual |

Media keys and the lock screen work too: play/pause, and next/previous for
channel up/down, with the artist and the concert's thumbnail shown.

### Live and VCR

Channels are **live** by default. Every channel plays the whole lineup on a
loop, in a fixed shuffled order, and each joins that loop at a different
point spaced by the golden ratio, so neighbouring channels are never showing
the same thing. What's on is a pure function of the clock (counted from
2026-01-01 UTC). Links share the channel (`?ch=700`), and whoever opens
one joins mid-concert, at the same moment as everyone else.

Switch Broadcast to **VCR** in SETUP and each channel instead plays its own
concert from the start; links then share the video (`?v=<id>`).

### SETUP

Drawn inside the tube. The channel control picks a row and the volume
control changes it, so it works the same with the knobs, keys, 2D or 3D.

| Setting | Effect |
|---|---|
| Broadcast | Live / VCR |
| Scanlines | Scanline strength, 0–10 |
| Curvature | Edge fall-off and corner darkening, 0–10 |
| Warm-up | A slow power-on bloom, or near-instant |
| Degauss | A colour shiver as each new picture locks in |
| VHS | Tape jitter, colour bleed, a tracking band, and PLAY ▶ |
| Hiss | Tuning hiss while the antenna moves |
| Captions | The video's captions (English, including auto-generated, where the concert has any), off by default |

### The TV guide

The listings digest on top of the set (or **G**) opens to the channel you're
watching. Live, each channel shows what's on now (with progress) and what's
next, with times; in VCR mode, each channel's concert. Turn pages with ← / →,
the corner buttons or a swipe, jump with the thumb tabs or the `CH` box, or
search by artist or title (press `/`). Each search result says which channel
it's on right now, or plays it from the start if no channel is showing it.
Pick any listing to tune in.

### Remembered between visits

Volume, brightness, the last channel, the SETUP settings and the 2D/3D choice
are kept in `localStorage`. On load the set tunes to a `?ch=` / `?v=` link,
else the last channel, else a random one.

## Channel data

The lineup lives in `public/channels.json`, built by
`scripts/fetch-channels.mjs` from NPR Music's uploads playlist: every public,
embeddable Tiny Desk video longer than two minutes, with a cleaned-up title,
the artist's name and the duration. The app only fetches that static file, so
no API key reaches the browser and visitors use no YouTube API quota.

- Put the key in `.env` as `YOUTUBE_API_KEY=...`. The older
  `REACT_APP_YOUTUBE_API_KEY` name still works for the script, but the
  `REACT_APP_` prefix is meant for values that are safe to ship to browsers.
- `npm run channels` refreshes the file, and it also runs before
  `npm run build`. Routine runs are cheap:
  - It skips if it already checked in the last day.
  - Otherwise it only pages back to the newest video it already has, which
    costs 1–2 quota units.
  - Once a week it does a full sweep (roughly 100–250 units) to drop videos
    that were removed or can no longer be embedded.
- `npm run channels -- --force` checks now, and `-- --full` forces a full
  sweep. When it last checked is kept in `node_modules/.cache`, so a run that
  finds nothing new leaves `channels.json` untouched.
- Without a key the existing file is kept, so commit it. Leave the key off
  your hosting provider unless you want deploys to refresh the list.
- To keep the key safe, restrict it to the YouTube Data API v3 in Google
  Cloud.

## How it's built

Create React App (React 18), with
[react-player](https://github.com/cookpete/react-player) for YouTube and
[@react-three/fiber](https://github.com/pmndrs/react-three-fiber) /
[drei](https://github.com/pmndrs/drei) for the 3D set. There are no image
or audio files: the wood, labels, knurling, speaker grilles and tuning hiss
are all generated in code. The one outside asset is the TV guide's channel
numeral face, DM Serif Display, from Google Fonts (other type uses system
fonts).

```
src/
  App.js              app state: tuning, volume, power, menus, shortcuts
  components/
    TV.js             the 2D set
    tv3d/             the 3D set (loaded on first use)
      TVModel.js      cabinet, controls, antenna, guide stack
      materials.js    procedural textures and geometry
    Screen.js         the picture tube (shared by both sets)
    Osd.js            on-screen display and the SETUP menu
    Guide.js          the TV guide
    Help.js           the owner's manual
  hooks/              tuner, antenna gesture, retune, settings, shortcuts…
  js/
    schedule.js       the broadcast schedule
    listings.js       the guide's pages and search
    woodGrain.js      procedural wood, shared by both sets
    …
scripts/
  fetch-channels.mjs  builds public/channels.json
```

### Notes

- **One tube, two sets.** A cross-origin YouTube iframe can't be used as a
  WebGL texture, so in 3D the picture tube is the same DOM `<Screen>` placed
  in the scene with drei's `<Html transform occlude="blending">`. drei renders
  a depth-only hole where the screen sits, so the iframe shows through while
  the cabinet still hides it correctly. Chrome draws that layer out of place
  when the canvas lands on fractional pixels, so the 3D area is snapped to
  whole, even pixels (`TV3D.css`, `TV3D.js`).
- **Clean picture.** YouTube's controls are hidden: the 16:9 player is cropped
  to the 4:3 tube, a shield blocks its hover overlay, captions are switched
  off, and static covers the tube until each video actually plays.
- **3D renders on demand.** The scene only redraws while something moves
  (`frameloop="demand"`), and the three.js code downloads when the 2D/3D
  switch is hovered or focused.
- **Same wood in both sets.** `woodGrain.js` paints log-sliced grain, pores
  and figure onto canvases. 3D uses them as textures under a clearcoat; 2D
  uses them as CSS backgrounds, painted when the browser is idle.
- **Antenna.** Retuning picks from a shuffle bag, so channels don't repeat
  until most of the lineup has come up. The hiss is Web Audio noise, not an
  audio file.
- **Dependencies.** `@react-three/fiber` is pinned to v8 and
  `@react-three/drei` to v9 because the app is on React 18 (R3F v9 needs
  React 19). `three` is pinned to `0.174.0`, the release contemporary with
  those versions.

## Tests

`npm test` runs the unit tests for the pure logic:
- the schedule (`schedule.test.js`)
- the guide's listings and search (`listings.test.js`)
- the shuffle bag (`shuffleBag.test.js`)
- the SETUP settings (`crtSettings.test.js`)

The build also lints with the CRA `react-app` ESLint config.

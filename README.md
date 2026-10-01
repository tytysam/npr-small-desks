# NPR Small Desk

A vintage TV (2D and 3D) that tunes through every NPR Music Tiny Desk concert.
What's next is tracked in [docs/ROADMAP.md](docs/ROADMAP.md).

## Channel data

The lineup lives in `public/channels.json`, built by
`scripts/fetch-channels.mjs` from NPR Music's uploads playlist. The app only
fetches that static file, so no YouTube API key reaches the browser.

- `npm run channels` refreshes it, and it also runs before `npm run build`.
  Routine runs are cheap: it skips if it checked in the last day, and
  otherwise only pages back to the newest video it already has (1–2 quota
  units). Once a week it does a full sweep (roughly 100–250 units) to drop
  videos that were removed or can no longer be embedded.
- `npm run channels -- --force` checks now; `-- --full` forces a full sweep.
  When it last checked is kept in `node_modules/.cache`, so a run that finds
  nothing new doesn't touch `channels.json`.
- Without a key, the existing file is kept, so commit it. Leave the key off
  your hosting provider unless you want deploys to refresh the list.
- Put the key in `.env` as `YOUTUBE_API_KEY=...` (the older
  `REACT_APP_YOUTUBE_API_KEY` name still works for the script, but the
  `REACT_APP_` prefix is meant for values that are safe to ship to browsers).

## Controls

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
| G | Open the TV guide (in the guide: ← / → turn pages, / search) |

New visitors can press the "?" beside the 2D/3D toggle (or **?**) for a
short owner's manual.

On the set: the chrome slide switch is power, the lever on the rail is
play/pause, the small black knob is brightness, and the chrome knob by the
NP-R1 badge is MENU. Drag the antenna to hunt for a station, tap it to
retune, or press and hold it to scan. The listings digest on top of the set
is the TV guide: what's on every channel now and next, searchable by artist;
pick a listing to tune in.

Stations are **live** by default: each runs a shared schedule, so links like
`?ch=700` put everyone on the same moment. Switch Broadcast to **VCR** in
SETUP to play concerts from the start (links then use `?v=<id>`).

---

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

## Modes

The set can be viewed as a CSS-built console (**2D**) or a three.js scene (**3D**). The switch in the top-right corner powers the set down CRT-style, swaps modes, and powers it back up; the video resumes where it left off and the chosen mode is remembered in `localStorage`.

### How the 3D screen works

A cross-origin YouTube iframe can't be used as a WebGL texture, so in 3D the picture tube is the same DOM `<Screen>` component placed in the scene with drei's `<Html transform occlude="blending">`. drei keeps the element behind the canvas and renders a depth-only "hole" in the scene where the screen sits, so the iframe shows through while the cabinet still occludes it correctly.

### Dependency notes

- `@react-three/fiber` is pinned to v8 and `@react-three/drei` to v9 because the app is on React 18 (R3F v9 requires React 19).
- `three` is pinned to `0.174.0`, the release contemporary with those versions.

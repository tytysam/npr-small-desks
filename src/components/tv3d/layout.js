import { SCREEN_W, SCREEN_H } from './ScreenSurface';

// The cabinet's layout in world units, shared by the model (TVModel.jsx) and
// the camera's views (SceneCamera.jsx).
//
// Depth, front to back: the outer rim of the cabinet (FRONT_Z) → the recessed
// front board (BOARD_Z) that carries the bezel, control column and rail → the
// tube, sunk behind the bezel's rolled opening → the cabinet body behind it.
export const CABINET = { w: 6.5, h: 4.7, d: 3.4 };
export const FRONT_Z = CABINET.d / 2;
const RIM = 0.18;
export const BOARD = { w: CABINET.w - RIM * 2, h: CABINET.h - RIM * 2 };
export const BOARD_Z = FRONT_Z - 0.12;
export const BODY_FRONT_Z = FRONT_Z - 0.5;
export const BODY = { d: BODY_FRONT_Z + CABINET.d / 2, z: (BODY_FRONT_Z - CABINET.d / 2) / 2 };
export const TOP_Y = CABINET.h / 2;
export const BOTTOM_Y = -CABINET.h / 2;

// Honey-wood bezel: a narrow flat face that rolls over into a cove and sinks
// to a pillow-shaped opening just inside the tube's edge.
export const BEZEL = { x: -0.73, y: 0.35, w: 4.44, h: 3.44 };
export const OPENING = { w: SCREEN_W - 0.1, h: SCREEN_H - 0.1, r: 0.52 };
export const OPENING_Z = -0.13; // relative to BOARD_Z
export const TUBE_Z = BOARD_Z + OPENING_Z - 0.02;

// The TV guide on top of the set, spines toward the viewer (the camera sits
// below the top, so the spines are what reads from the front; the cover
// shows when you orbit up).
export const GUIDE = { length: 1.45, width: 1.05, x: -1.75, z: 1.08, lift: 0.06 };

/** Where the Scene pane's camera views look. */
export const VIEW_ANCHORS = {
  screen: [BEZEL.x, BEZEL.y, TUBE_Z],
  screenSize: [BEZEL.w, BEZEL.h],
  guide: [GUIDE.x, TOP_Y + 0.1, GUIDE.z],
};

/** The 3D camera's vertical field of view, in degrees. */
export const FOV = 38;

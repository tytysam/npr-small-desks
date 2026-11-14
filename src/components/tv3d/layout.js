import { SCREEN_W, SCREEN_H } from './ScreenSurface';

/** The 3D camera's vertical field of view, in degrees. */
export const FOV = 38;

/** The TV guide on the top board (where it lies is the cabinet's). */
export const GUIDE_SIZE = { length: 1.45, width: 1.05, lift: 0.06 };

/**
 * A cabinet's layout in world units, from its measurements (cabinets.js),
 * shared by the model (TVModel.jsx) and the camera's views (SceneCamera.jsx).
 * The cabinet is centred on the origin; +Z faces the viewer.
 *
 * Depth, front to back: the outer rim of the cabinet (FRONT_Z) → the recessed
 * front board (BOARD_Z) that carries the bezel, controls and rail → the tube,
 * sunk behind the bezel's rolled opening → the cabinet body behind it.
 */
export const makeLayout = (spec) => {
  const CABINET = spec.cabinet;
  const FRONT_Z = CABINET.d / 2;
  const RIM = 0.18;
  const BOARD = { w: CABINET.w - RIM * 2, h: CABINET.h - RIM * 2 };
  const BOARD_Z = FRONT_Z - 0.12;
  const BODY_FRONT_Z = FRONT_Z - 0.5;
  const BODY = { d: BODY_FRONT_Z + CABINET.d / 2, z: (BODY_FRONT_Z - CABINET.d / 2) / 2 };
  // The body's centre height: 0, unless it's a base under the tube (cream).
  const CABINET_Y = CABINET.y ?? 0;
  const TOP_Y = CABINET_Y + CABINET.h / 2;
  const BOTTOM_Y = CABINET_Y - CABINET.h / 2;
  // Where the guide and the antenna stand: the top board's upper face, or
  // the cabinet's own `topFace` (the cream set's shell).
  const TOP_FACE = spec.topFace ?? TOP_Y + spec.top.y + spec.top.thickness / 2;

  // The bezel: a narrow flat face that rolls over into a cove and sinks to a
  // pillow-shaped opening just inside the tube's edge. The tube is the same
  // in every cabinet.
  const BEZEL = spec.bezel;
  const OPENING = { w: SCREEN_W - 0.1, h: SCREEN_H - 0.1, r: 0.52 };
  const OPENING_Z = -0.13; // relative to BOARD_Z
  const TUBE_Z = BOARD_Z + OPENING_Z - 0.02;

  // The guide lies near the front of the top board, spines toward the viewer
  // (the camera sits below the top, so the spines are what reads from the
  // front; the cover shows when you orbit up).
  const GUIDE = { ...GUIDE_SIZE, ...spec.guide };

  return {
    CABINET,
    CABINET_Y,
    FRONT_Z,
    BOARD,
    BOARD_Z,
    BODY_FRONT_Z,
    BODY,
    TOP_Y,
    BOTTOM_Y,
    TOP_FACE,
    BEZEL,
    OPENING,
    OPENING_Z,
    TUBE_Z,
    GUIDE,
    // Where the Scene pane's camera views look.
    VIEW_ANCHORS: {
      screen: [BEZEL.x, BEZEL.y, TUBE_Z],
      screenSize: [BEZEL.w, BEZEL.h],
      guide: [GUIDE.x, TOP_FACE, GUIDE.z],
    },
  };
};

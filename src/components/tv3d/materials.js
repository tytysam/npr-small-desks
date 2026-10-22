import * as THREE from 'three';
import { WOOD, getWood } from '../../js/woodGrain';
import { SIGNATURE } from '../../js/signature';

// Tuned against the tokens at the top of TV.css so both sets read as the same TV.
export const PALETTE = {
  walnut: WOOD.walnut,
  honey: WOOD.honey,
  panel: { light: '#3b3a36', dark: '#24231f' },
  chrome: '#e6e6e6',
  glass: '#121412',
  amber: '#ffb347',
  cream: '#e8dfc8',
};


const lerp = (a, b, t) => a + (b - a) * t;

const finishTexture = (canvas, { repeat = [1, 1], srgb = true } = {}) => {
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
};

const makeCanvas = (w, h) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
};

/**
 * Wood textures for a preset ('walnut' | 'honey') from the shared grain
 * generator (src/js/woodGrain.js): colour, bump and roughness maps.
 */
export const makeWoodTexture = (name) => {
  const wood = getWood(name);
  return {
    map: finishTexture(wood.color),
    bumpMap: finishTexture(wood.bump, { srgb: false }),
    roughnessMap: finishTexture(wood.rough, { srgb: false }),
  };
};

/**
 * Varnished wood: a fairly rough, bumpy base under a glossy clearcoat, so
 * highlights stay crisp while the grain still reads through them.
 */
export const makeWoodMaterial = (wood, { tint = '#ffffff', clearcoat = 0.55 } = {}) =>
  new THREE.MeshPhysicalMaterial({
    color: tint,
    map: wood.map,
    bumpMap: wood.bumpMap,
    bumpScale: 0.35,
    roughnessMap: wood.roughnessMap,
    roughness: 1,
    metalness: 0,
    clearcoat,
    clearcoatRoughness: 0.28,
  });

/**
 * Re-maps UVs by projecting each face onto the box plane it most faces, in
 * world-ish units (`offset` is the mesh's position). One texture tile spans
 * `span` units, so neighbouring meshes line up. Grain (texture U) runs along X
 * on the front, top and bottom and front-to-back on the sides, as veneer would.
 */
export const boxProjectUVs = (geometry, { span = 7, offset = [0, 0, 0], shift = [0.5, 0.5] } = {}) => {
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i) + offset[0];
    const y = pos.getY(i) + offset[1];
    const z = pos.getZ(i) + offset[2];
    const ax = Math.abs(nrm.getX(i));
    const ay = Math.abs(nrm.getY(i));
    const az = Math.abs(nrm.getZ(i));
    let u;
    let v;
    if (az >= ax && az >= ay) {
      u = x;
      v = y;
    } else if (ay >= ax) {
      u = x;
      v = z;
    } else {
      u = z;
      v = y;
    }
    uv[i * 2] = u / span + shift[0];
    uv[i * 2 + 1] = v / span + shift[1];
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
};

/** A slab that narrows (and optionally leans) toward its foot; its top face sits flat at y = 0. */
export const makeTaperedLegGeometry = ({ width, depth, length, footScale = [0.5, 0.7], splay = [0, 0] }) => {
  const geometry = new THREE.BoxGeometry(width, length, depth, 1, 4, 1);
  geometry.translate(0, -length / 2, 0);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const t = -pos.getY(i) / length; // 0 at the top, 1 at the foot
    // Taper, then lean the foot out by `splay` (x, z). Shearing rather than
    // rotating keeps the top face flat, so it sits flush against what it's under.
    pos.setX(i, pos.getX(i) * lerp(1, footScale[0], t) + splay[0] * t);
    pos.setZ(i, pos.getZ(i) * lerp(1, footScale[1], t) + splay[1] * t);
  }
  geometry.computeVertexNormals();
  return geometry;
};

/**
 * Points around a rounded rectangle, corner by corner, `perCorner` per arc.
 * Every ring built with the same `perCorner` has matching vertices, so rings
 * of different sizes and radii can be lofted together.
 */
const roundedRectRing = (w, h, r, perCorner) => {
  const corners = [
    [w / 2 - r, h / 2 - r],
    [-(w / 2 - r), h / 2 - r],
    [-(w / 2 - r), -(h / 2 - r)],
    [w / 2 - r, -(h / 2 - r)],
  ];
  const points = [];
  corners.forEach(([cx, cy], c) => {
    for (let k = 0; k < perCorner; k += 1) {
      const a = (c + k / (perCorner - 1)) * (Math.PI / 2);
      points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  });
  return points;
};

/**
 * Lofts a sequence of rounded-rectangle rings ({ w, h, r, z }) into one
 * smooth surface, facing outward/forward. Used for the CRT bezel's profile.
 */
export const makeLoftGeometry = (rings, perCorner = 10) => {
  const loops = rings.map(({ w, h, r, z }) => roundedRectRing(w, h, r, perCorner).map(([x, y]) => [x, y, z]));
  const n = loops[0].length;
  const positions = new Float32Array(loops.length * n * 3);
  loops.forEach((loop, j) =>
    loop.forEach(([x, y, z], i) => {
      positions.set([x, y, z], (j * n + i) * 3);
    })
  );
  const indices = [];
  for (let j = 0; j < loops.length - 1; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const a = j * n + i;
      const b = j * n + ((i + 1) % n);
      const c = (j + 1) * n + i;
      const d = (j + 1) * n + ((i + 1) % n);
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

/** Speaker panel: dark metal punched with a regular grid of holes. */
export const makePerforatedTexture = ({ repeat = [1, 1] } = {}) => {
  const size = 64;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#4a4843');
  g.addColorStop(1, '#3a3834');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // Two holes per tile, offset so the grid tiles seamlessly.
  [
    [size * 0.25, size * 0.25],
    [size * 0.75, size * 0.75],
  ].forEach(([x, y]) => {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(x, y + 1.5, size * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b0b0a';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.13, 0, Math.PI * 2);
    ctx.fill();
  });
  return finishTexture(canvas, { repeat });
};

/**
 * Knurled rim: one tooth per tile, bright crest to dark valley. Used as a
 * bump and roughness map on an open cylinder, repeated `teeth` times around.
 */
export const makeKnurlTexture = (teeth = 48) => {
  const w = 32;
  const h = 4;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#202020');
  g.addColorStop(0.45, '#ffffff');
  g.addColorStop(0.55, '#ffffff');
  g.addColorStop(1, '#202020');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return finishTexture(canvas, { repeat: [teeth, 1], srgb: false });
};

/** Soft vertical window reflection on the left of the glass, plus a faint top sheen. */
export const makeGlareTexture = () => {
  const w = 256;
  const h = 192;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w * 0.14, h * 0.34);
  ctx.scale(1, 3.2);
  const streak = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.08);
  streak.addColorStop(0, 'rgba(255,255,255,0.75)');
  streak.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  streak.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = streak;
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const sheen = ctx.createRadialGradient(w * 0.3, h * 0.12, 0, w * 0.3, h * 0.12, w * 0.4);
  sheen.addColorStop(0, 'rgba(255,255,255,0.3)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/**
 * Text baked into a texture so the 3D set needs no font download.
 * `width`/`height` are canvas pixels; keep the aspect equal to the plane's.
 */
export const makeLabelTexture = (
  text,
  {
    width = 512,
    height = 128,
    font = 'bold 64px Georgia, serif',
    color = '#1a1a1a',
    background = null,
    letterSpacing = 0,
    glow = null,
  } = {}
) => {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  if (background) {
    if (Array.isArray(background)) {
      const g = ctx.createLinearGradient(0, 0, 0, height);
      background.forEach((stop, i) => g.addColorStop(i / (background.length - 1), stop));
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = background;
    }
    ctx.fillRect(0, 0, width, height);
  }
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (letterSpacing && 'letterSpacing' in ctx) ctx.letterSpacing = `${letterSpacing}px`;
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = height * 0.2;
  }
  const maxWidth = width * 0.9;
  ctx.fillText(text, width / 2, height / 2 + 2, maxWidth);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};

/** Numbered ring (2–13) with a pointer at twelve o'clock, printed on the panel around the channel knob. */
export const makeChannelRingTexture = () => {
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.41;
  ctx.fillStyle = PALETTE.cream;
  ctx.font = 'bold 38px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 12; i += 1) {
    const angle = (i * 30 - 90) * (Math.PI / 180);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    ctx.fillText(String(i + 2), x, y);
  }
  // amber pointer triangle at the top, just inside the numerals
  ctx.fillStyle = PALETTE.amber;
  ctx.beginPath();
  ctx.moveTo(cx - 12, size * 0.14);
  ctx.lineTo(cx + 12, size * 0.14);
  ctx.lineTo(cx, size * 0.14 + 18);
  ctx.closePath();
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};

/** Volume tick marks over a 270° sweep. */
export const makeVolumeTicksTexture = () => {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  ctx.strokeStyle = PALETTE.cream;
  ctx.lineCap = 'round';
  for (let i = 0; i <= 10; i += 1) {
    const angle = (-135 + i * 27 - 90) * (Math.PI / 180);
    const major = i % 5 === 0;
    const inner = size * (major ? 0.38 : 0.41);
    const outer = size * 0.46;
    ctx.lineWidth = major ? 5 : 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const roundedRect = (path, x, y, w, h, r) => {
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
};

/**
 * A rounded-rectangle frame with a rounded-rectangle opening, extruded toward +Z.
 *
 * Note three.js bevels push the walls *outward* from the shape's contour, so
 * the outer edge grows and the opening shrinks by `bevelSize` at mid-depth;
 * callers size `outer*`/`inner*` accordingly. `innerOffset` moves the opening
 * off-centre.
 */
export const makeFrameGeometry = ({
  outerW,
  outerH,
  innerW,
  innerH,
  depth,
  radius = 0.3,
  innerRadius = radius * 0.8,
  bevelSize = 0.03,
  bevelThickness = bevelSize,
  bevelSegments = 3,
  innerOffset = [0, 0],
}) => {
  const shape = new THREE.Shape();
  roundedRect(shape, -outerW / 2, -outerH / 2, outerW, outerH, radius);
  const hole = new THREE.Path();
  roundedRect(hole, innerOffset[0] - innerW / 2, innerOffset[1] - innerH / 2, innerW, innerH, innerRadius);
  shape.holes.push(hole);
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevelSize > 0,
    bevelThickness,
    bevelSize,
    bevelSegments,
    curveSegments: 20,
  });
};

/**
 * A gently domed rectangle for the tube glass: flat at the rim (z = 0),
 * bulging to `bulge` at the centre.
 */
export const makeDomeGeometry = (w, h, bulge) => {
  const geometry = new THREE.PlaneGeometry(w, h, 32, 24);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const u = pos.getX(i) / (w / 2);
    const v = pos.getY(i) / (h / 2);
    pos.setZ(i, bulge * (1 - u * u) * (1 - v * v));
  }
  geometry.computeVertexNormals();
  return geometry;
};

const SPINE_FONT = '900 34px Rockwell, "Courier New", serif';

/**
 * The TV guide's printing, for a digest lying on its back with the spine
 * toward the viewer: the cover (for the box's top face, drawn turned a
 * quarter so its spine edge is at the front) and a spine for each issue in
 * the stack, guide first.
 */
export const makeGuideTextures = (issues) => {
  // Cover art is portrait (W × H); the canvas holds it turned so the art's
  // left (spine) edge lands on the canvas bottom, i.e. the box's front.
  const W = 512;
  const H = 704;
  const coverCanvas = makeCanvas(H, W);
  const ctx = coverCanvas.getContext('2d');
  ctx.translate(0, W);
  ctx.rotate(-Math.PI / 2);
  const paper = ctx.createLinearGradient(0, 0, W, H);
  paper.addColorStop(0, '#eadfc4');
  paper.addColorStop(1, '#c9b994');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  // Masthead: a red block sized to the text, with even padding all round.
  ctx.font = '900 92px Rockwell, "Courier New", serif';
  ctx.textBaseline = 'alphabetic';
  const mast = ctx.measureText('NP-R1');
  const pad = 18;
  const textW = mast.actualBoundingBoxLeft + mast.actualBoundingBoxRight;
  const textH = mast.actualBoundingBoxAscent + mast.actualBoundingBoxDescent;
  const blockX = 36;
  const blockY = 40;
  ctx.fillStyle = '#c4372b';
  ctx.fillRect(blockX, blockY, textW + pad * 2, textH + pad * 2);
  ctx.fillStyle = '#fff8ec';
  ctx.fillText('NP-R1', blockX + pad + mast.actualBoundingBoxLeft, blockY + pad + mast.actualBoundingBoxAscent);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#221a12';
  ctx.font = '900 64px Rockwell, "Courier New", serif';
  ctx.fillText('LISTINGS', 40, 220);
  // a halftone "photo"
  ctx.save();
  ctx.beginPath();
  ctx.arc(330, 430, 140, 0, Math.PI * 2);
  ctx.clip();
  const photo = ctx.createRadialGradient(290, 390, 10, 330, 430, 150);
  photo.addColorStop(0, '#8a6a4a');
  photo.addColorStop(1, '#2e2117');
  ctx.fillStyle = photo;
  ctx.fillRect(180, 280, 300, 300);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  for (let y = 280; y < 580; y += 9) for (let x = 180; x < 480; x += 9) ctx.fillRect(x, y, 3, 3);
  ctx.restore();
  ctx.fillStyle = '#5a4a36';
  ctx.font = 'italic 36px Georgia, serif';
  ctx.fillText('Tiny Desk Weekly', 40, 640);
  const cover = new THREE.CanvasTexture(coverCanvas);
  cover.colorSpace = THREE.SRGBColorSpace;
  cover.anisotropy = 8;

  const spines = issues.map(({ color, ink, text }) => {
    const canvas = makeCanvas(H, 64);
    const c = canvas.getContext('2d');
    c.fillStyle = color;
    c.fillRect(0, 0, H, 64);
    c.fillStyle = 'rgba(0, 0, 0, 0.18)'; // the fold, top and bottom
    c.fillRect(0, 0, H, 5);
    c.fillRect(0, 59, H, 5);
    c.fillStyle = ink;
    c.font = SPINE_FONT;
    c.textBaseline = 'middle';
    c.fillText(text, 24, 34, H - 48);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  });

  return { cover, spines };
};

/**
 * The set's back: a hardboard panel with vent slots, the printed caution, a
 * rating plate, and the inspector's tag, signed. `width` × `height` in canvas
 * pixels; keep the aspect equal to the plane's.
 */
export const makeBackPanelTexture = ({ width = 2048, height = 1454 } = {}) => {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const text = (str, x, y, font, color, align = 'center') => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  };

  // Hardboard: warm brown, flecked.
  const board = ctx.createLinearGradient(0, 0, width, height);
  board.addColorStop(0, '#8c6642');
  board.addColorStop(1, '#6e4c2e');
  ctx.fillStyle = board;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 9000; i += 1) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,230,200' : '20,10,0'},${0.04 + Math.random() * 0.06})`;
    ctx.fillRect(Math.random() * width, Math.random() * height, 2 + Math.random() * 3, 1 + Math.random() * 2);
  }

  // Screws, one per corner.
  [
    [70, 70],
    [width - 70, 70],
    [70, height - 70],
    [width - 70, height - 70],
  ].forEach(([x, y]) => {
    const head = ctx.createRadialGradient(x - 8, y - 8, 2, x, y, 26);
    head.addColorStop(0, '#e8e4dc');
    head.addColorStop(1, '#6d6a64');
    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a3834';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - 15, y - 6);
    ctx.lineTo(x + 15, y + 6);
    ctx.stroke();
  });

  // Vent slots: three rows across the top, where the tube's heat gets out.
  const slotW = 26;
  const slotH = 150;
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 26; col += 1) {
      const x = 250 + col * 60;
      const y = 150 + row * 190;
      const path = new Path2D();
      roundedRect(path, x, y, slotW, slotH, slotW / 2);
      ctx.fillStyle = '#140b05';
      ctx.fill(path);
      ctx.strokeStyle = 'rgba(255, 220, 180, 0.12)';
      ctx.lineWidth = 3;
      ctx.stroke(path);
    }
  }

  // The printed caution, centre bottom.
  const ink = 'rgba(18, 10, 4, 0.82)';
  const cx = width * 0.47;
  text('CAUTION', cx, 750, 'bold 64px Georgia, serif', ink);
  [
    'TO REDUCE THE RISK OF ELECTRIC SHOCK, DO NOT',
    'REMOVE BACK. NO USER-SERVICEABLE PARTS INSIDE.',
    'REFER SERVICING TO QUALIFIED SERVICE PERSONNEL.',
  ].forEach((line, i) => text(line, cx, 815 + i * 44, 'bold 34px "Courier New", monospace', ink));

  // Rating plate, bottom left.
  const plate = ctx.createLinearGradient(160, 1080, 760, 1320);
  plate.addColorStop(0, '#d9d7d0');
  plate.addColorStop(0.5, '#a9a69e');
  plate.addColorStop(1, '#cfccc4');
  ctx.fillStyle = plate;
  ctx.fillRect(160, 1080, 600, 250);
  ctx.strokeStyle = '#3d3b37';
  ctx.lineWidth = 4;
  ctx.strokeRect(172, 1092, 576, 226);
  const etch = '#24221e';
  text('MODEL NP-R1', 460, 1140, 'bold 44px Georgia, serif', etch);
  text('120 V ~ 60 Hz  145 W', 460, 1200, 'bold 30px "Courier New", monospace', etch);
  text('SERIAL No. 000001', 460, 1248, 'bold 30px "Courier New", monospace', etch);
  text('SMALL DESK ELECTRONICS', 460, 1292, '24px Georgia, serif', etch);

  // The inspector's tag, bottom right: yellowed paper, a little askew.
  ctx.save();
  ctx.translate(1600, 1165);
  ctx.rotate(-0.05);
  const tagW = 560;
  const tagH = 480;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  const paper = ctx.createLinearGradient(-tagW / 2, -tagH / 2, tagW / 2, tagH / 2);
  paper.addColorStop(0, '#f1e6c8');
  paper.addColorStop(1, '#d8c79e');
  ctx.fillStyle = paper;
  ctx.fillRect(-tagW / 2, -tagH / 2, tagW, tagH);
  ctx.shadowColor = 'transparent';
  const tagInk = '#2b2418';
  ctx.fillStyle = tagInk;
  ctx.fillRect(-tagW / 2, -tagH / 2, tagW, 70);
  text('INSPECTED', 0, -tagH / 2 + 37, 'bold 44px Georgia, serif', '#f1e6c8');
  const field = (label, value, y) => {
    text(label, -tagW / 2 + 32, y, 'bold 24px "Courier New", monospace', tagInk, 'left');
    text(value, tagW / 2 - 32, y, 'bold 30px "Courier New", monospace', tagInk, 'right');
    ctx.fillStyle = 'rgba(43, 36, 24, 0.4)';
    ctx.fillRect(-tagW / 2 + 32, y + 22, tagW - 64, 2);
  };
  field('MODEL', 'NP-R1', -135);
  field('SERIAL', '000001', -75);
  field('DATE', 'OCT 2026', -15);
  text('INSPECTOR', -tagW / 2 + 32, 45, 'bold 24px "Courier New", monospace', tagInk, 'left');

  // Signed in blue-black ink.
  const [sx, sy, sw, sh] = SIGNATURE.viewBox;
  const sigW = 240;
  const scale = sigW / sw;
  ctx.save();
  ctx.translate(-tagW / 2 + 40, 122 - (sh * scale) / 2);
  ctx.scale(scale, scale);
  ctx.translate(-sx, -sy);
  ctx.strokeStyle = '#1d2a5c';
  ctx.lineWidth = SIGNATURE.strokeWidth * 0.9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  SIGNATURE.paths.forEach((d) => ctx.stroke(new Path2D(d)));
  ctx.restore();
  // The signature line, with the name typed under it.
  ctx.fillStyle = 'rgba(43, 36, 24, 0.55)';
  ctx.fillRect(-tagW / 2 + 32, 186, 300, 2);
  text('Tyler C. Samuelson', -tagW / 2 + 32, 210, 'bold 24px "Courier New", monospace', tagInk, 'left');

  // A red rubber stamp beside it.
  ctx.save();
  ctx.translate(tagW / 2 - 95, 135);
  ctx.rotate(0.3);
  ctx.globalAlpha = 0.72;
  ctx.strokeStyle = '#b3261e';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.stroke();
  text('QC', 0, -12, 'bold 38px Georgia, serif', '#b3261e');
  text('No. 7', 0, 24, 'bold 22px "Courier New", monospace', '#b3261e');
  ctx.restore();
  ctx.restore();

  return finishTexture(canvas);
};

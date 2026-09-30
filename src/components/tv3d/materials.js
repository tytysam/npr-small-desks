import * as THREE from 'three';

// Tuned against the tokens at the top of TV.css so both sets read as the same TV.
export const PALETTE = {
  // earlywood (light, porous spring growth) → latewood (dense, dark summer growth)
  walnut: { early: '#7e4b26', late: '#56301a' },
  honey: { early: '#c0843f', late: '#985c2b' },
  panel: { light: '#3b3a36', dark: '#24231f' },
  chrome: '#e6e6e6',
  glass: '#121412',
  amber: '#ffb347',
  cream: '#e8dfc8',
};

const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Deterministic 2D value noise so textures look the same on every mount.
const makeNoise = (seed) => {
  const hash = (ix, iy) => {
    let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = lerp(hash(ix, iy), hash(ix + 1, iy), sx);
    const b = lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), sx);
    return lerp(a, b, sy);
  };
  const fbm = (x, y, octaves) => {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    for (let o = 0; o < octaves; o += 1) {
      sum += noise(x, y) * amp;
      norm += amp;
      amp *= 0.5;
      x *= 2.03;
      y *= 2.03;
    }
    return sum / norm;
  };
  return { noise, fbm };
};

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
 * Plain-sawn veneer, modelled as a flat slice through a virtual log.
 *
 * Grain runs along texture U. The log's pith lies a little way beneath the
 * slice and tapers along U, so growth rings (distance from the pith) open into
 * the arches ("cathedrals") of flat-cut veneer; `pithDepth` large gives
 * straighter, quarter-sawn-looking lines. Keep `pithDepth > taper / 2` so the
 * slice never reaches the pith, or rings close into bullseyes. Rings are warped with fbm, each ring
 * darkens gradually through the earlywood into a latewood band and snaps back,
 * and stretched noise adds fibres and pore flecks.
 *
 * Returns colour, bump (latewood and pores sit lower under the varnish) and
 * roughness maps sharing the same layout.
 */
export const makeWoodTexture = ({
  palette = PALETTE.walnut,
  seed = 1979,
  size = 1024,
  ringPx = 15,
  pithDepth = 0.26,
  taper = 0.24,
  warp = 1.3,
} = {}) => {
  const w = size;
  const h = size;
  const colorCanvas = makeCanvas(w, h);
  const bumpCanvas = makeCanvas(w, h);
  const roughCanvas = makeCanvas(w, h);
  const colorImg = colorCanvas.getContext('2d').createImageData(w, h);
  const bumpImg = bumpCanvas.getContext('2d').createImageData(w, h);
  const roughImg = roughCanvas.getContext('2d').createImageData(w, h);
  const { noise, fbm } = makeNoise(seed);

  const early = hexToRgb(palette.early);
  const late = hexToRgb(palette.late);

  for (let y = 0; y < h; y += 1) {
    const v = y / h;
    for (let x = 0; x < w; x += 1) {
      const u = x / w;

      // distance from the pith, in rings
      const dy = (v - 0.5) * h;
      const d = (pithDepth + taper * (u - 0.5) + (fbm(u * 1.5, v * 1.5, 2) - 0.5) * 0.1) * h;
      const r = Math.sqrt(dy * dy + d * d);
      const ring = r / ringPx + (fbm(u * 2.5, v * 5, 3) - 0.5) * warp;
      const f = ring - Math.floor(ring);
      const lateMix = Math.pow(smoothstep(0.35, 0.97, f), 1.6);

      // fibres: streaks stretched hard along the grain
      const fibre = noise(u * 24, (v * h) / 1.3) - 0.5;
      // pores: short dark dashes, a fresh pattern every row
      const pore = smoothstep(0.8, 0.95, noise(x / 9, y / 0.9));
      // broad colour variation across the board ("figure")
      const figure = fbm(u * 2.2 + 7, v * 2.2, 2) - 0.5;

      const shade = (1 + figure * 0.3 + fibre * 0.07) * (1 - pore * 0.12);
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        colorImg.data[i + c] = Math.min(255, lerp(early[c], late[c], lateMix * 0.7) * shade);
      }
      colorImg.data[i + 3] = 255;

      const height = 255 * (0.8 - lateMix * 0.2 - pore * 0.2 + fibre * 0.05);
      bumpImg.data[i] = bumpImg.data[i + 1] = bumpImg.data[i + 2] = height;
      bumpImg.data[i + 3] = 255;

      const rough = 255 * (0.5 + lateMix * 0.1 + pore * 0.15);
      roughImg.data[i] = roughImg.data[i + 1] = roughImg.data[i + 2] = rough;
      roughImg.data[i + 3] = 255;
    }
  }
  colorCanvas.getContext('2d').putImageData(colorImg, 0, 0);
  bumpCanvas.getContext('2d').putImageData(bumpImg, 0, 0);
  roughCanvas.getContext('2d').putImageData(roughImg, 0, 0);
  return {
    map: finishTexture(colorCanvas),
    bumpMap: finishTexture(bumpCanvas, { srgb: false }),
    roughnessMap: finishTexture(roughCanvas, { srgb: false }),
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

/** A slab that narrows toward its foot; its top face sits at y = 0. */
export const makeTaperedLegGeometry = ({ width, depth, length, footScale = [0.5, 0.7] }) => {
  const geometry = new THREE.BoxGeometry(width, length, depth, 1, 4, 1);
  geometry.translate(0, -length / 2, 0);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const t = -pos.getY(i) / length; // 0 at the top, 1 at the foot
    pos.setX(i, pos.getX(i) * lerp(1, footScale[0], t));
    pos.setZ(i, pos.getZ(i) * lerp(1, footScale[1], t));
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

/**
 * Procedural wood grain, shared by both sets: the 3D set wraps these canvases
 * as three.js textures, the 2D set uses them as CSS background images. No
 * three.js here, so the 2D bundle stays light.
 */

// earlywood (light, porous spring growth) → latewood (dense, dark summer growth)
export const WOOD = {
  walnut: { early: '#7e4b26', late: '#56301a' },
  honey: { early: '#c0843f', late: '#985c2b' },
};

/**
 * The two woods on the set. The bezel is cut farther from the pith, so its
 * grain runs straighter and finer.
 */
export const WOOD_PRESETS = {
  walnut: { palette: WOOD.walnut },
  honey: { palette: WOOD.honey, seed: 42, size: 512, ringPx: 11, pithDepth: 0.3, taper: 0.2, warp: 1.2 },
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
 * roughness canvases sharing the same layout.
 */
const paintWood = ({
  palette = WOOD.walnut,
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
  return { color: colorCanvas, bump: bumpCanvas, rough: roughCanvas };
};

const cache = new Map();

/**
 * The painted canvases for a preset ('walnut' | 'honey'), drawn once per
 * visit and shared — switching between 2D and 3D doesn't repaint them.
 */
export const getWood = (name) => {
  if (!cache.has(name)) cache.set(name, paintWood(WOOD_PRESETS[name]));
  return cache.get(name);
};

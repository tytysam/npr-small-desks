import * as THREE from 'three';

// Small deterministic PRNG so textures look the same on every mount.
const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const lerp = (a, b, t) => a + (b - a) * t;

const finishTexture = (canvas, { repeat = [1, 1] } = {}) => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
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

/** Walnut veneer: broad, slowly wandering grain bands with fine per-pixel noise. */
export const makeWoodTexture = () => {
  const w = 1024;
  const h = 1024;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const rand = mulberry32(1979);

  const dark = [70, 42, 20];
  const mid = [104, 64, 30];
  const light = [138, 90, 44];

  // Grain runs along X; each column shifts the band pattern a little so
  // bands wander instead of reading as ruled lines.
  const wobble = new Float32Array(w);
  for (let x = 0; x < w; x += 1) {
    wobble[x] = Math.sin(x / 260) * 12 + Math.sin(x / 71) * 4 + Math.sin(x / 23) * 1.2;
  }

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const gy = y + wobble[x];
      // Mix of slow, wide bands and finer figure; kept low-contrast.
      let t =
        Math.sin(gy * 0.045) * 0.5 +
        Math.sin(gy * 0.13 + Math.sin(x / 300) * 2) * 0.3 +
        Math.sin(gy * 0.6) * 0.08;
      t = (t + 0.9) / 1.8; // ~0..1
      t += (rand() - 0.5) * 0.1;
      t = Math.min(1, Math.max(0, t));
      const from = t < 0.5 ? dark : mid;
      const to = t < 0.5 ? mid : light;
      const k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      const i = (y * w + x) * 4;
      img.data[i] = lerp(from[0], to[0], k);
      img.data[i + 1] = lerp(from[1], to[1], k);
      img.data[i + 2] = lerp(from[2], to[2], k);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finishTexture(canvas, { repeat: [1, 1] });
};

/** Speaker cloth: dark brown with a diagonal weave. */
export const makeGrilleTexture = () => {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3a2b1a';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 3;
  for (let i = -size; i < size * 2; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i + size, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,220,170,0.08)';
  ctx.lineWidth = 1;
  for (let i = -size; i < size * 2; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i + 4, 0);
    ctx.lineTo(i + 4 + size, size);
    ctx.stroke();
  }
  return finishTexture(canvas, { repeat: [6, 1] });
};

/** Soft diagonal highlight for the glass in front of the tube. */
export const makeGlareTexture = () => {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const radial = ctx.createRadialGradient(size * 0.22, size * 0.15, 0, size * 0.22, size * 0.15, size * 0.6);
  radial.addColorStop(0, 'rgba(255,255,255,0.7)');
  radial.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  radial.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, size, size);
  const diagonal = ctx.createLinearGradient(0, 0, size, size);
  diagonal.addColorStop(0, 'rgba(255,255,255,0.35)');
  diagonal.addColorStop(0.35, 'rgba(255,255,255,0.05)');
  diagonal.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = diagonal;
  ctx.fillRect(0, 0, size, size);
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
  { width = 512, height = 128, font = 'bold 64px Georgia, serif', color = '#1a1a1a', background = null, letterSpacing = 0 } = {}
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
  const maxWidth = width * 0.9;
  ctx.fillText(text, width / 2, height / 2 + 2, maxWidth);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};

/** Numbered ring (2–13) with a pointer at twelve o'clock, drawn around the channel knob. */
export const makeChannelRingTexture = () => {
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.4;
  ctx.fillStyle = '#e2c46a';
  ctx.font = 'bold 40px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 12; i += 1) {
    const angle = (i * 30 - 90) * (Math.PI / 180);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    ctx.fillText(String(i + 2), x, y);
  }
  // pointer triangle at the top, just inside the numerals
  ctx.beginPath();
  ctx.moveTo(cx - 12, size * 0.15);
  ctx.lineTo(cx + 12, size * 0.15);
  ctx.lineTo(cx, size * 0.15 + 18);
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
  ctx.strokeStyle = '#d8b85e';
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

/** Bezel: rounded rectangle with a rounded rectangular screen cutout. */
export const makeBezelGeometry = ({ outerW, outerH, innerW, innerH, depth, radius = 0.3 }) => {
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
  const shape = new THREE.Shape();
  roundedRect(shape, -outerW / 2, -outerH / 2, outerW, outerH, radius);
  const hole = new THREE.Path();
  roundedRect(hole, -innerW / 2, -innerH / 2, innerW, innerH, radius * 0.8);
  shape.holes.push(hole);
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 3,
    curveSegments: 16,
  });
};
